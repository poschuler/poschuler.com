import { describe, expect, it } from "vitest";

import type { SeededRow } from "../../../seed/d1/seed-sql";
import {
  buildProjectSeedSql,
  isInvalidProject,
  projectRowFor,
  type ProjectFrontMatter,
  type ProjectNoteFile,
  type ProjectRows,
} from "../../../seed/d1/project-sql";

/**
 * A Project is not a Content Item — no Published At, no place in the Timeline —
 * so it has its own table and its own rules. What it shares with `content` is
 * the shape of the seed: upserts first, prune last, never a leading delete.
 *
 * 1b adds the manifest: which Field Notes a Project holds, and in what order
 * (Part 8 of `evolution-plan/14-phase-1b-field-notes.md`) — a flat list, not
 * an arc, reconciled against the notes on disk the same way a Series' Parts
 * are (`manifest.ts`, shared rather than copied).
 */

const MANIFEST = "projects/chekalo/chekalo.en.md";

const project = (overrides: Partial<ProjectFrontMatter> = {}): ProjectFrontMatter => ({
  type: "project",
  title: "Chekalo",
  summary: "Price intelligence across nine Peruvian retailers.",
  description: "A price intelligence platform.",
  tier: "flagship",
  status: "active",
  stack: ["TypeScript", "Node.js"],
  liveUrl: "https://chekalo.pe",
  sortOrder: 1,
  updates: [{ date: "2026-08-20", note: "First published." }],
  ...overrides,
});

const noteFile = (slug: string, overrides: Partial<ProjectNoteFile> = {}): ProjectNoteFile => ({
  slug,
  lang: "en",
  folder: slug,
  relativePath: `projects/chekalo/${slug}/${slug}.en.md`,
  draft: false,
  ...overrides,
});

const rowsFor = (
  attributes: ProjectFrontMatter = project(),
  noteFiles: ProjectNoteFile[] = [],
): ProjectRows => {
  const result = projectRowFor(MANIFEST, attributes, noteFiles);

  if (isInvalidProject(result)) {
    throw new Error(`expected rows, got: ${result.error}`);
  }

  return result;
};

const errorFor = (
  attributes: ProjectFrontMatter,
  noteFiles: ProjectNoteFile[] = [],
): string => {
  const result = projectRowFor(MANIFEST, attributes, noteFiles);

  expect(isInvalidProject(result)).toBe(true);

  return (result as { error: string }).error;
};

describe("projectRowFor", () => {
  it("emits an upsert keyed by (Slug, Locale), with the slug from the filename", () => {
    const { project: row } = rowsFor();

    expect(row.key).toBe("chekalo:en");
    expect(row.statement).toContain("INSERT OR REPLACE INTO project");
    expect(row.statement).toContain("'chekalo', 'en'");
  });

  it("serialises the stack as JSON and an absent one as an empty array", () => {
    const withStack = rowsFor().project;
    const without = rowsFor(project({ stack: undefined })).project;

    expect(withStack.statement).toContain(`'["TypeScript","Node.js"]'`);
    expect(without.statement).toContain(`'[]'`);
  });

  it("defaults sort_order rather than letting it be null", () => {
    const row = rowsFor(project({ sortOrder: undefined })).project;

    expect(row.statement).toMatch(/, 0,/);
  });

  /**
   * A Project has no Published At, so its most recent revision is the only date
   * it has — and the sitemap needs one. An empty list would silently fall back
   * to the generic date for the whole site.
   */
  it("fails a Project with no revisions at all", () => {
    expect(errorFor(project({ updates: [] }))).toMatch(/at least one/);
  });

  it("fails a Project whose language is not in its filename", () => {
    const result = projectRowFor("projects/a/a.md", project(), []);

    expect(isInvalidProject(result)).toBe(true);
  });

  it.each([
    ["tier", { tier: "featured" as never }, /tier/],
    ["status", { status: "live" as never }, /status/],
    ["summary", { summary: "  " }, /summary/],
  ])("fails an unusable %s", (_field, overrides, message) => {
    expect(errorFor(project(overrides))).toMatch(message);
  });

  /**
   * `experiment` is accepted by the schema from the first day even though
   * nothing is one — SQLite cannot alter a CHECK, so adding it later means
   * recreating the table by hand in production.
   */
  it("accepts experiment, which the schema allows before anything uses it", () => {
    const result = projectRowFor(MANIFEST, project({ tier: "experiment" }), []);

    expect(isInvalidProject(result)).toBe(false);
  });

  it("fails a file handed to it from outside the projects tree", () => {
    const result = projectRowFor("blog/a/a.en.md", project(), []);

    expect(isInvalidProject(result)).toBe(true);
  });
});

/**
 * The manifest declares which Field Notes the Project holds, and in what
 * order — a flat list, not an arc: no sections, no Destination, nothing that
 * checks contiguity (Part 8).
 */
describe("projectRowFor — the notes", () => {
  it("has no notes when the manifest declares none, which is a Project's state before its first one", () => {
    expect(rowsFor().notes.size).toBe(0);
  });

  it("reads a note's position out of the list", () => {
    const attributes = project({ notes: ["product-matching", "alias-flip"] });
    const files = [noteFile("product-matching"), noteFile("alias-flip")];

    const { notes } = rowsFor(attributes, files);

    expect(notes.get("product-matching")).toEqual({ projectSlug: "chekalo", order: 0 });
    expect(notes.get("alias-flip")).toEqual({ projectSlug: "chekalo", order: 1 });
  });

  /** Reordering is a line moved in one file, the same property a Series has. */
  it("renumbers every note when the list is reordered, with nothing else edited", () => {
    const attributes = project({ notes: ["alias-flip", "product-matching"] });
    const files = [noteFile("product-matching"), noteFile("alias-flip")];

    const { notes } = rowsFor(attributes, files);

    expect(notes.get("alias-flip")?.order).toBe(0);
    expect(notes.get("product-matching")?.order).toBe(1);
  });

  it("fails a notes list that is not a list", () => {
    expect(errorFor(project({ notes: "product-matching" as never }))).toMatch(
      /not a list/,
    );
  });

  it("fails a manifest listing an empty Field Note", () => {
    expect(errorFor(project({ notes: [""] }))).toMatch(/lists an empty Field Note/);
  });

  /**
   * A note listed in the manifest while it is a Draft is accepted, and does
   * not break reconciliation: `reconcileManifest` does not distinguish a
   * Draft file from a published one, so a Project with published notes can
   * list a Draft alongside them and still hold its position (Part 9).
   */
  it("accepts a note listed in the manifest while it is a Draft, without breaking reconciliation", () => {
    const attributes = project({ notes: ["product-matching", "alias-flip"] });
    const files = [noteFile("product-matching"), noteFile("alias-flip", { draft: true })];

    const { notes } = rowsFor(attributes, files);

    expect(notes.get("alias-flip")).toEqual({ projectSlug: "chekalo", order: 1 });
  });
});

/**
 * The invariant `manifest.ts` shares with `series-sql.ts`: a listed note with
 * no file fails, a file no manifest lists fails, and a note listed twice fails.
 */
describe("projectRowFor — manifest and disk must reconcile", () => {
  it("fails a listed note with no file", () => {
    expect(errorFor(project({ notes: ["product-matching"] }), [])).toMatch(
      /lists the Field Note 'product-matching', which has no file/,
    );
  });

  it("fails a file no manifest lists", () => {
    expect(errorFor(project(), [noteFile("product-matching")])).toMatch(
      /product-matching.en.md is not listed/,
    );
  });

  it("fails a note listed twice", () => {
    const attributes = project({ notes: ["product-matching", "product-matching"] });

    expect(errorFor(attributes, [noteFile("product-matching")])).toMatch(
      /lists the Field Note 'product-matching' twice/,
    );
  });

  /** Everything downstream builds the path back from the Slug. */
  it("fails a note whose filename and folder disagree", () => {
    const attributes = project({ notes: ["renamed"] });
    const files = [{ ...noteFile("renamed"), folder: "product-matching" }];

    expect(errorFor(attributes, files)).toMatch(/is not named after its folder/);
  });
});

/**
 * `draft: true` on a Project landing. Part 5's rule is stricter here than on a
 * Post — a Container may be a Draft only while it holds no published content.
 */
describe("projectRowFor — Drafts", () => {
  it("marks the result a draft when every listed note is a draft too, after every other check has passed", () => {
    const attributes = project({ draft: true, notes: ["product-matching"] });
    const files = [noteFile("product-matching", { draft: true })];

    const { draft, project: row, notes } = rowsFor(attributes, files);

    expect(draft).toBe(true);
    // Still built, so a caller needing the placements has them — see
    // `generate-seed-sql.ts`. Whether to seed `project` is the caller's
    // decision, driven by `draft`.
    expect(row.statement).toContain("INSERT OR REPLACE INTO project");
    expect(notes.get("product-matching")).toEqual({ projectSlug: "chekalo", order: 0 });
  });

  it("marks the result published when the flag is absent, exactly as today", () => {
    expect(rowsFor().draft).toBe(false);
  });

  /** A Draft passes every check a published one would. */
  it("still fails a draft Project for every reason a published one would", () => {
    expect(errorFor(project({ draft: true, tier: "featured" as never }))).toMatch(/tier/);
  });

  it("fails a non-boolean draft value rather than reading it as truthy", () => {
    expect(errorFor(project({ draft: "true" as never }))).toMatch(/draft must be true or false/);
  });

  /**
   * The rule this ticket adds: no cascade. A drafted Container does not hide
   * its published children, it refuses to coexist with them, and the message
   * names both.
   */
  it("fails a Project marked draft while one of its notes is published, naming the Container and the child", () => {
    const attributes = project({ draft: true, notes: ["product-matching", "alias-flip"] });
    const files = [
      noteFile("product-matching", { draft: false }),
      noteFile("alias-flip", { draft: true }),
    ];

    expect(errorFor(attributes, files)).toBe(
      `${MANIFEST} is a draft, but 'product-matching' is published — a Post cannot be reached through a Container that is not.`,
    );
  });

  it("passes when a drafted Project has no notes at all yet", () => {
    expect(rowsFor(project({ draft: true }), []).draft).toBe(true);
  });

  /**
   * The round trip: publishing inserted this Project's row through
   * `buildProjectSeedSql`'s upsert; marking it a draft removes it from the
   * rows the generator hands that function, so the existing prune deletes it.
   */
  it("removes a previously published Project's row through the existing prune once it becomes a draft", () => {
    const chekalo = rowsFor().project;
    const other = projectRowFor(
      "projects/poschuler-com/poschuler-com.en.md",
      project({ sortOrder: 2 }),
      [],
    ) as ProjectRows;

    const sqlWhilePublished = buildProjectSeedSql([chekalo, other.project]);
    expect(sqlWhilePublished).toContain(
      "DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'poschuler-com:en')",
    );

    const draftResult = rowsFor(project({ draft: true }));
    expect(draftResult.draft).toBe(true);

    // The generator's walk now hands only `other`'s row to the builder — the
    // same keep-list mechanism, with chekalo's key excluded.
    const sqlAfterDraft = buildProjectSeedSql([other.project]);
    expect(sqlAfterDraft).toContain("DELETE FROM project WHERE slug || ':' || lang NOT IN ('poschuler-com:en')");
  });
});

describe("buildProjectSeedSql", () => {
  const rows = (): SeededRow[] => [
    rowsFor().project,
    (projectRowFor("projects/poschuler-com/poschuler-com.en.md", project(), []) as ProjectRows)
      .project,
  ];

  it("puts every insert before the prune", () => {
    const sql = buildProjectSeedSql(rows());

    expect(sql.indexOf("INSERT OR REPLACE")).toBeLessThan(sql.indexOf("DELETE FROM project"));
  });

  it("prunes by identity, keeping every row a Markdown file still backs", () => {
    const sql = buildProjectSeedSql(rows());

    expect(sql).toContain(
      "DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'poschuler-com:en')",
    );
  });

  /**
   * Unlike `content`, an empty list is a real state here: Phase 1a ships before
   * any Project is written. It must not emit a prune that deletes everything on
   * the strength of an empty list.
   */
  it("emits nothing at all when there are no projects", () => {
    expect(buildProjectSeedSql([])).toBe("");
  });

  /**
   * The bug an empty list alone cannot rule out: the site's one Project going
   * draft looks identical, from `rows.length`, to no Project ever having been
   * written — unless the caller says otherwise. Without `anyFilesFound`, this
   * would leave a previously published Project's row live in D1 forever.
   */
  it("prunes everything when every Project the walk found is a draft", () => {
    const sql = buildProjectSeedSql([], { anyFilesFound: true });

    expect(sql).toContain("DELETE FROM project WHERE slug || ':' || lang NOT IN ()");
  });
});
