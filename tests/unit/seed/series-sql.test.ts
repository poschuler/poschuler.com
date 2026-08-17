import { describe, expect, it } from "vitest";

import {
  buildSeriesSeedSql,
  isInvalidSeries,
  seriesRowsFor,
  type SeriesFrontMatter,
  type SeriesPartFile,
  type SeriesRows,
} from "../../../seed/d1/series-sql";
import type { SeededRow } from "../../../seed/d1/seed-sql";

/**
 * The manifest declares the arc, and a Part does not know where it is
 * (ADR 0007). Everything below is the consequence: the positions are read from
 * the lists, and the invariants are the ones a list cannot state for itself.
 */

const MANIFEST = "series/api/api.en.md";

const manifest = (overrides: Partial<SeriesFrontMatter> = {}): SeriesFrontMatter => ({
  type: "series",
  title: "An API",
  description: "About an API",
  status: "ongoing",
  startingPoint: "You can build a CRUD endpoint.",
  destination: "A deployed API you can keep changing.",
  outOfScope: ["Microservices"],
  audience: "For you if you can ship features.",
  sections: [
    {
      slug: "fundamentals",
      title: "Fundamentals",
      summary: "Where the code goes.",
      parts: ["project-setup", "error-handling"],
    },
    { slug: "persistence", title: "Persistence", summary: "Postgres and migrations." },
  ],
  ...overrides,
});

const partFile = (slug: string, overrides: Partial<SeriesPartFile> = {}): SeriesPartFile => ({
  slug,
  lang: "en",
  folder: slug,
  relativePath: `series/api/${slug}/${slug}.en.md`,
  draft: false,
  ...overrides,
});

const FILES = [partFile("project-setup"), partFile("error-handling")];

const BODY = "Why this series exists.";

const rowsFor = (
  attributes: SeriesFrontMatter = manifest(),
  files: SeriesPartFile[] = FILES,
): SeriesRows => {
  const result = seriesRowsFor(MANIFEST, attributes, BODY, files);

  if (isInvalidSeries(result)) {
    throw new Error(`expected rows, got: ${result.error}`);
  }

  return result;
};

const errorFor = (
  attributes: SeriesFrontMatter,
  files: SeriesPartFile[] = FILES,
  body = BODY,
): string => {
  const result = seriesRowsFor(MANIFEST, attributes, body, files);

  expect(isInvalidSeries(result)).toBe(true);

  return (result as { error: string }).error;
};

describe("seriesRowsFor — the Series row", () => {
  it("emits an upsert keyed by (Slug, Locale)", () => {
    const { series } = rowsFor();

    expect(series.key).toBe("api:en");
    expect(series.statement).toContain("INSERT OR REPLACE INTO series");
    expect(series.statement).toContain("'api', 'en', 'An API'");
  });

  it("stores out of scope as JSON, the way every list in this schema is stored", () => {
    expect(rowsFor().series.statement).toContain(`'["Microservices"]'`);
  });

  /**
   * Not `updates`, deliberately: ADR 0005 gives Revisions to a document with no
   * other possible date, and a Series has one — a Part arrived, and the Part is
   * dated.
   */
  it("carries the contract and no revisions column", () => {
    const { series } = rowsFor();

    expect(series.statement).toContain(
      "(slug, lang, title, description, status, starting_point, destination, out_of_scope, audience, updated_at)",
    );
    expect(series.statement).not.toContain("updates");
  });
});

describe("seriesRowsFor — the sections", () => {
  it("numbers them by their position in the list, not by a field", () => {
    const { sections } = rowsFor();

    expect(sections).toHaveLength(2);
    expect(sections[0].statement).toContain("'fundamentals', 'Fundamentals', 'Where the code goes.', NULL, 0");
    expect(sections[1].statement).toContain("'persistence'");
    expect(sections[1].statement).toContain(", 1,");
  });

  it("keys a section by its Series, its Locale and its own Slug", () => {
    expect(rowsFor().sections[0].key).toBe("api:en:fundamentals");
  });

  /** A promise the author holds, and the only state that cannot be observed. */
  it("stores a declared complete", () => {
    const attributes = manifest({
      sections: [
        {
          slug: "fundamentals",
          title: "Fundamentals",
          summary: "Where the code goes.",
          status: "complete",
          parts: ["project-setup", "error-handling"],
        },
      ],
    });

    expect(rowsFor(attributes).sections[0].statement).toContain("'complete', 0");
  });
});

describe("seriesRowsFor — where each Part sits", () => {
  it("reads a Part's section and position out of the lists", () => {
    const { parts } = rowsFor();

    expect(parts.get("project-setup")).toEqual({
      seriesSlug: "api",
      section: "fundamentals",
      order: 0,
    });
    expect(parts.get("error-handling")).toEqual({
      seriesSlug: "api",
      section: "fundamentals",
      order: 1,
    });
  });

  /**
   * Reordering is a line moved in one file. That is the whole reason `order`
   * left the Parts' front matter.
   */
  it("renumbers every Part when the list is reordered, with nothing else edited", () => {
    const attributes = manifest({
      sections: [
        {
          slug: "fundamentals",
          title: "Fundamentals",
          summary: "Where the code goes.",
          parts: ["error-handling", "project-setup"],
        },
      ],
    });

    const { parts } = rowsFor(attributes);

    expect(parts.get("error-handling")?.order).toBe(0);
    expect(parts.get("project-setup")?.order).toBe(1);
  });
});

describe("seriesRowsFor — the contract must be complete", () => {
  it.each(["startingPoint", "destination", "audience"] as const)(
    "fails a manifest with no %s, naming the field",
    (field) => {
      expect(errorFor(manifest({ [field]: "  " }))).toMatch(new RegExp(`has no ${field}`));
    },
  );

  it("fails a manifest whose out of scope is empty", () => {
    expect(errorFor(manifest({ outOfScope: [] }))).toMatch(/has no outOfScope/);
  });

  /**
   * The landing renders the contract from data; the body is the voice. Optional
   * would mean forgotten, and a mute landing published with nothing failing.
   */
  it("fails a manifest with no body", () => {
    expect(errorFor(manifest(), FILES, "\n  \n")).toMatch(/has no body/);
  });

  it("fails a status the schema would refuse", () => {
    expect(errorFor(manifest({ status: "paused" }))).toMatch(/expected one of ongoing, complete/);
  });

  it("fails a manifest with no sections at all", () => {
    expect(errorFor(manifest({ sections: [] }))).toMatch(/declares no sections/);
  });
});

describe("seriesRowsFor — a section states only what cannot be observed", () => {
  const withSection = (section: Record<string, unknown>) =>
    manifest({ sections: [{ slug: "s", title: "S", summary: "About.", ...section }] });

  /**
   * Planned and in-progress are read from whether the section has Parts.
   * Declaring either would restore two sources of truth free to disagree.
   */
  it.each(["planned", "in-progress"])("fails a section declaring %s", (status) => {
    expect(errorFor(withSection({ status, parts: [] }), [])).toMatch(/only declarable value/);
  });

  it("fails a section marked complete with no Parts", () => {
    expect(errorFor(withSection({ status: "complete", parts: [] }), [])).toMatch(
      /marked complete with no Parts/,
    );
  });

  it("fails a section with no summary, which the landing renders whatever its state", () => {
    expect(errorFor(manifest({ sections: [{ slug: "s", title: "S", summary: "" }] }), [])).toMatch(
      /has no summary/,
    );
  });

  it("fails a manifest that lists the same section twice", () => {
    const attributes = manifest({
      sections: [
        { slug: "s", title: "One", summary: "About." },
        { slug: "s", title: "Two", summary: "About." },
      ],
    });

    expect(errorFor(attributes, [])).toMatch(/lists the section 's' twice/);
  });
});

/**
 * The invariant that replaced *contiguous order* and *no shared position*, both
 * of which stopped being representable the moment order became a list. This one
 * catches what actually happens: writing a Part and forgetting to index it.
 */
describe("seriesRowsFor — manifest and disk must reconcile", () => {
  it("fails a listed Part with no file", () => {
    expect(errorFor(manifest(), [partFile("project-setup")])).toMatch(
      /lists the Part 'error-handling', which has no file/,
    );
  });

  it("fails a file no section lists", () => {
    const attributes = manifest({
      sections: [
        {
          slug: "fundamentals",
          title: "Fundamentals",
          summary: "Where the code goes.",
          parts: ["project-setup"],
        },
      ],
    });

    expect(errorFor(attributes)).toMatch(/error-handling.en.md is not listed/);
  });

  it("fails a Part listed in two sections", () => {
    const attributes = manifest({
      sections: [
        { slug: "one", title: "One", summary: "About.", parts: ["project-setup"] },
        {
          slug: "two",
          title: "Two",
          summary: "About.",
          parts: ["project-setup", "error-handling"],
        },
      ],
    });

    expect(errorFor(attributes)).toMatch(/in both 'one' and 'two'/);
  });

  /** Everything downstream builds the path back from the Slug. */
  it("fails a Part whose filename and folder disagree", () => {
    const attributes = manifest({
      sections: [
        { slug: "fundamentals", title: "Fundamentals", summary: "About.", parts: ["renamed"] },
      ],
    });

    const files = [{ ...partFile("renamed"), folder: "project-setup" }];

    expect(errorFor(attributes, files)).toMatch(/is not named after its folder/);
  });
});

describe("seriesRowsFor — the path decides what the file is", () => {
  it("fails a Part handed to the Series generator", () => {
    const result = seriesRowsFor("series/api/part/part.en.md", manifest(), BODY, []);

    expect(isInvalidSeries(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/is not a Series manifest/);
  });

  it("fails a manifest declaring a type its position does not allow", () => {
    const result = seriesRowsFor(MANIFEST, { ...manifest(), type: "post" as never }, BODY, FILES);

    expect(isInvalidSeries(result)).toBe(true);
  });

  /**
   * A landing is one page, revised in place, so a missing Locale is a
   * mistake. `draft: true` is the only way one goes unpublished — see below.
   */
  it("fails a manifest with no Locale in its filename", () => {
    const result = seriesRowsFor("series/api/api.md", manifest(), BODY, FILES);

    expect(isInvalidSeries(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/must have a language/);
  });
});

/**
 * `draft: true` on a Series manifest. Part 5's rule is stricter here
 * than on a Post — a Container may be a Draft only while it holds no
 * published content, checked below.
 */
describe("seriesRowsFor — Drafts", () => {
  it("marks the result a draft when every listed Part is a draft too, after every other check has passed", () => {
    const files = [
      partFile("project-setup", { draft: true }),
      partFile("error-handling", { draft: true }),
    ];

    const { draft, series, sections } = rowsFor(manifest({ draft: true }), files);

    expect(draft).toBe(true);
    // Still built, so a caller needing the placements has them — see
    // `generate-seed-sql.ts`. Whether to seed `series`/`sections` is the
    // caller's decision, driven by `draft`.
    expect(series.statement).toContain("INSERT OR REPLACE INTO series");
    expect(sections).toHaveLength(2);
  });

  it("marks the result published when the flag is absent, exactly as today", () => {
    expect(rowsFor().draft).toBe(false);
  });

  /** Part 12's promise: a Draft passes every check a published one would. */
  it("still fails a draft manifest for every reason a published one would", () => {
    expect(errorFor(manifest({ draft: true, startingPoint: "  " }))).toMatch(/has no startingPoint/);
  });

  it("fails a non-boolean draft value rather than reading it as truthy", () => {
    expect(errorFor(manifest({ draft: "true" as never }))).toMatch(/draft must be true or false/);
  });

  /**
   * The rule this ticket adds: no cascade. A drafted Container does not hide
   * its published children, it refuses to coexist with them, and the message
   * names both.
   */
  it("fails a Series marked draft while one of its Parts is published, naming the Container and the child", () => {
    const files = [
      partFile("project-setup", { draft: false }),
      partFile("error-handling", { draft: true }),
    ];

    const error = errorFor(manifest({ draft: true }), files);

    expect(error).toBe(
      `${MANIFEST} is a draft, but 'project-setup' is published — a Post cannot be reached through a Container that is not.`,
    );
  });

  it("passes when a drafted Series has no Parts at all yet", () => {
    const attributes = manifest({
      draft: true,
      sections: [{ slug: "fundamentals", title: "Fundamentals", summary: "Where the code goes." }],
    });

    expect(rowsFor(attributes, []).draft).toBe(true);
  });

  /**
   * The round trip (Part 12's last rule): publishing inserted this Series's
   * rows through `buildSeriesSeedSql`'s upsert; marking it a draft removes it
   * from the rows the generator hands that function, so the existing prune —
   * `DELETE FROM series WHERE … NOT IN (keyList)` — deletes it. A second,
   * always-published Series keeps the row list non-empty throughout, the way
   * `buildSeriesSeedSql([], [])` is deliberately a no-op for the day nothing
   * has ever been written (see its own tests below).
   */
  it("removes a previously published Series's rows through the existing prune once it becomes a draft", () => {
    const otherFiles = [
      partFile("project-setup", { relativePath: "series/other/project-setup/project-setup.en.md" }),
      partFile("error-handling", { relativePath: "series/other/error-handling/error-handling.en.md" }),
    ];
    const otherResult = seriesRowsFor("series/other/other.en.md", manifest(), BODY, otherFiles);

    if (isInvalidSeries(otherResult)) {
      throw new Error(`expected rows, got: ${otherResult.error}`);
    }

    const api = rowsFor();

    const sqlWhilePublished = buildSeriesSeedSql([api.series, otherResult.series], [
      ...api.sections,
      ...otherResult.sections,
    ]);
    expect(sqlWhilePublished).toContain(
      "DELETE FROM series WHERE slug || ':' || lang NOT IN ('api:en', 'other:en')",
    );

    const draftResult = rowsFor(
      manifest({ draft: true }),
      [partFile("project-setup", { draft: true }), partFile("error-handling", { draft: true })],
    );
    expect(draftResult.draft).toBe(true);

    // The generator's walk now hands only `other`'s rows to the builder — the
    // same keep-list mechanism, with the drafted manifest's key excluded.
    const sqlAfterDraft = buildSeriesSeedSql([otherResult.series], otherResult.sections);
    expect(sqlAfterDraft).toContain("DELETE FROM series WHERE slug || ':' || lang NOT IN ('other:en')");
  });
});

describe("buildSeriesSeedSql", () => {
  const rows = () => rowsFor();

  it("puts every insert before the prunes", () => {
    const { series, sections } = rows();
    const sql = buildSeriesSeedSql([series], sections);

    expect(sql.indexOf("INSERT OR REPLACE INTO series ")).toBeLessThan(
      sql.indexOf("DELETE FROM series"),
    );
    expect(sql.indexOf("INSERT OR REPLACE INTO series_section")).toBeLessThan(
      sql.indexOf("DELETE FROM series_section"),
    );
  });

  /**
   * Without the second prune, a section removed from a manifest stays alive in
   * the database and keeps rendering on the landing.
   */
  it("prunes both tables by identity", () => {
    const { series, sections } = rows();
    const sql = buildSeriesSeedSql([series], sections);

    expect(sql).toContain("DELETE FROM series WHERE slug || ':' || lang NOT IN ('api:en')");
    expect(sql).toContain(
      "DELETE FROM series_section WHERE series_slug || ':' || lang || ':' || slug NOT IN ('api:en:fundamentals', 'api:en:persistence')",
    );
  });

  /**
   * A repository with no Series is an ordinary state. A prune built from an
   * empty list would delete every row on the strength of finding nothing.
   */
  it("emits nothing at all when there are no Series", () => {
    expect(buildSeriesSeedSql([], [] as SeededRow[])).toBe("");
  });

  /**
   * The bug an empty list alone cannot rule out: the site's one Series going
   * draft looks identical, from `seriesRows.length`, to no Series ever having
   * been written — unless the caller says otherwise. Without `anyFilesFound`,
   * this would leave a previously published Series's rows live in D1 forever.
   */
  it("prunes everything when every Series the walk found is a draft", () => {
    const sql = buildSeriesSeedSql([], [] as SeededRow[], { anyFilesFound: true });

    expect(sql).toContain("DELETE FROM series WHERE slug || ':' || lang NOT IN ()");
    expect(sql).toContain("DELETE FROM series_section WHERE series_slug || ':' || lang || ':' || slug NOT IN ()");
  });
});
