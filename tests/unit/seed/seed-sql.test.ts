import { describe, expect, it } from "vitest";

import {
  buildSeedSql,
  contentRowFor,
  duplicateKeys,
  escapeSql,
  isInvalid,
  isSkipped,
  parseContentFilename,
  type ContentRow,
  type FrontMatterAttributes,
  type SeededRow,
} from "../../../seed/d1/seed-sql";
import type { TagVocabulary } from "../../../seed/d1/tag-vocabulary";

/**
 * What ends up in production D1. The seed runs unattended in CI against the one
 * live database, so the rules below are not formatting preferences — a wrong
 * `DELETE` here empties the Timeline.
 */

/**
 * Stands in for `app/content/tags.json`, which the generator reads off the disk
 * and hands in. Built here rather than parsed, because what turns a file into a
 * vocabulary is `tag-vocabulary.test.ts`'s business; this file is about what a
 * Content Item is measured against.
 */
const VOCABULARY: TagVocabulary = new Set([
  "backend",
  "ddd",
  "nodejs",
  "software-architecture",
]);

const post = (overrides: Partial<FrontMatterAttributes> = {}): FrontMatterAttributes => ({
  type: "post",
  title: "A Post",
  publishedAt: "2026-01-01",
  description: "About something",
  repository: "https://github.com/poschuler/x",
  tags: ["ddd"],
  ...overrides,
});

const bookmark = (overrides: Partial<FrontMatterAttributes> = {}): FrontMatterAttributes => ({
  type: "link",
  title: "A Bookmark",
  publishedAt: "2026-01-01",
  externalUrl: "https://example.com/a",
  source: "Example",
  repository: "",
  tags: [],
  ...overrides,
});

describe("escapeSql", () => {
  it("doubles a single quote so a title with an apostrophe survives", () => {
    expect(escapeSql("Paul's résumé")).toBe("'Paul''s résumé'");
  });

  it("renders an absent value as NULL, not as an empty string", () => {
    expect(escapeSql(undefined)).toBe("NULL");
  });

  it("leaves double quotes and backslashes alone — SQLite has no escape for them here", () => {
    expect(escapeSql('a "quoted" \\ path')).toBe(`'a "quoted" \\ path'`);
  });
});

describe("parseContentFilename", () => {
  it.each([
    ["post.en.md", "post", "en"],
    ["post.es.md", "post", "es"],
    ["a.dotted.slug.en.md", "a.dotted.slug", "en"],
  ])("reads %s as slug and Locale", (filename, slug, lang) => {
    expect(parseContentFilename(filename)).toEqual({ slug, lang });
  });

  it("reads a Bookmark filename as a slug with no Locale", () => {
    expect(parseContentFilename("how-i-would-do-auth.md")).toEqual({
      slug: "how-i-would-do-auth",
      lang: null,
    });
  });

  /**
   * Only `en` and `es` count as a Locale, so `en-old` is absorbed into the
   * slug. `localeMatchesTree` (`content-tree.ts`) is what turns this into a
   * build failure under a tree that requires a Locale — see the Posts and
   * Bookmarks describe blocks below.
   */
  it("does not recognise en-old as a Locale", () => {
    expect(parseContentFilename("post.en-old.md")).toEqual({
      slug: "post.en-old",
      lang: null,
    });
  });

  /** The walker only hands over `.md` files, so this is the guard, not the path. */
  it.each(["notes.txt", "README", "post.md.bak"])("returns null for %s", (filename) => {
    expect(parseContentFilename(filename)).toBeNull();
  });
});

describe("contentRowFor — Posts", () => {
  it("emits an upsert keyed by (Slug, Locale)", () => {
    const result = contentRowFor("blog/value-objects/value-objects.en.md", post(), VOCABULARY);

    expect(isSkipped(result)).toBe(false);

    const row = result as SeededRow;
    expect(row.key).toBe("value-objects:en");
    expect(row.statement).toContain("INSERT OR REPLACE INTO content");
    expect(row.statement).toContain("'value-objects', 'en', 'post'");
  });

  /**
   * `INSERT OR REPLACE` is only a genuine upsert because of the partial unique
   * indexes. Losing it would turn a re-seed into duplicate rows.
   */
  it("upserts rather than inserting, so re-running the seed is a no-op", () => {
    const row = contentRowFor(
      "blog/value-objects/value-objects.en.md",
      post(),
      VOCABULARY,
    ) as SeededRow;

    expect(row.statement).toMatch(/INSERT OR REPLACE/);
    expect(row.statement).not.toMatch(/^\s*INSERT INTO/m);
  });

  it("carries the columns a Post has and none of the Bookmark ones", () => {
    const row = contentRowFor(
      "blog/value-objects/value-objects.en.md",
      post(),
      VOCABULARY,
    ) as SeededRow;

    expect(row.statement).toContain("(slug, lang, type, title, description, published_at, repository, updates, series_slug, series_section, project_slug, container_order, updated_at)");
    expect(row.statement).not.toContain("external_url");
  });

  /**
   * The Container columns travel together or not at all, which is why nothing
   * checks that they do: a loose Post is written with four NULLs rather than
   * with the columns omitted, so a Post that leaves a Series or a Project
   * cannot keep half of one.
   */
  it("writes a loose Post with no Container rather than with none of the columns", () => {
    const row = contentRowFor(
      "blog/value-objects/value-objects.en.md",
      post(),
      VOCABULARY,
    ) as SeededRow;

    expect(row.statement).toContain("'[]', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)");
  });

  /**
   * `en-old` is not a Locale the parser recognises, so a file declaring
   * `type: post` under `blog/` arrives with no Locale. It used to be absorbed
   * into the Slug and skipped without a word (Part 1 of
   * `evolution-plan/15-phase-3-spanish.md`) — now it fails the build, naming
   * the file.
   */
  it("fails a Post whose filename carries no recognised Locale", () => {
    const result = contentRowFor(
      "blog/setup-project/setup-project.en-old.md",
      post(),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toContain("blog/setup-project/setup-project.en-old.md");
    expect((result as { error: string }).error).toMatch(/no recognised Locale/);
  });
});

/**
 * ADR 0009: `draft: true` in front matter. The file is read, classified and
 * checked exactly like a published one, and only then produces nothing.
 */
describe("contentRowFor — Drafts", () => {
  it("skips a Post declaring itself a draft, after every other check has passed", () => {
    const result = contentRowFor("blog/a/a.en.md", post({ draft: true }), VOCABULARY);

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toBe("blog/a/a.en.md is a draft");
  });

  /**
   * Part 12's promise: a Draft passes every check a published document
   * passes. An undeclared Tag still fails the build, draft or not.
   */
  it("still fails a draft Post for every reason a published one would", () => {
    const result = contentRowFor(
      "blog/a/a.en.md",
      post({ draft: true, tags: ["not-a-declared-tag"] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
  });

  it("fails a draft Part that is not listed in its manifest, exactly as a published one would", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en.md",
      post({ draft: true }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/not listed in the pragmatic-nodejs-api manifest/);
  });

  /**
   * A Part that is listed and is a draft: every check a Part has to pass
   * still runs, and only then does it produce nothing.
   */
  it("skips a draft Part that is listed in its manifest, after the Container check passes", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en.md",
      post({ draft: true }),
      VOCABULARY,
      { seriesSlug: "pragmatic-nodejs-api", section: "fundamentals", order: 1 },
    );

    expect(isSkipped(result)).toBe(true);
  });

  /** JavaScript's own truthiness is not trusted for the flag. */
  it.each([["true"], ["yes"], [1]])("fails a non-boolean draft value %j rather than reading it as truthy", (value) => {
    const result = contentRowFor("blog/a/a.en.md", post({ draft: value as never }), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/draft must be true or false/);
  });

  it("behaves exactly as today when the flag is absent", () => {
    const result = contentRowFor("blog/a/a.en.md", post(), VOCABULARY);

    expect(isSkipped(result)).toBe(false);
    expect(isInvalid(result)).toBe(false);
  });

  it("skips a Bookmark declaring itself a draft, after every other check has passed", () => {
    const result = contentRowFor("bookmarks/a.md", bookmark({ draft: true }), VOCABULARY);

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toBe("bookmarks/a.md is a draft");
  });

  it("still fails a draft Bookmark for every reason a published one would", () => {
    const result = contentRowFor(
      "bookmarks/a.md",
      bookmark({ draft: true, tags: ["not-a-declared-tag"] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
  });

  it("fails a non-boolean draft value on a Bookmark", () => {
    const result = contentRowFor("bookmarks/a.md", bookmark({ draft: "true" as never }), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/draft must be true or false/);
  });

  /**
   * The round trip (Part 12's last rule): publishing inserted this row
   * through `buildSeedSql`'s upsert; marking the same file a draft removes
   * it from the rows the generator hands that function, so the existing
   * prune — `DELETE FROM content WHERE … NOT IN (keyList)` — deletes it. No
   * new mechanism, the same one every removed file already goes through.
   */
  it("removes a previously published Post's row through the existing prune once it becomes a draft", () => {
    const published = contentRowFor("blog/a/a.en.md", post(), VOCABULARY) as ContentRow;

    expect(isSkipped(published)).toBe(false);

    const sqlWhilePublished = buildSeedSql([published]);
    expect(sqlWhilePublished).toContain("DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN ('a:en')");

    const draftResult = contentRowFor("blog/a/a.en.md", post({ draft: true }), VOCABULARY);
    expect(isSkipped(draftResult)).toBe(true);

    // The generator collects rows from every file it walks; a draft
    // contributes none, so the row that survived above is gone from the list
    // `buildSeedSql` prunes against — the same keep-list mechanism, now
    // excluding it.
    const sqlAfterDraft = buildSeedSql([]);
    expect(sqlAfterDraft).toContain("DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN ()");
  });

  /**
   * `preview:drafts` (Part 3 of the field notes) — a Draft read as though it
   * were published, so it can be seeded into the local stores without ever
   * touching a tracked file. Both switch values are covered here, at the
   * generator seam; the script's own wiring is verified by running it.
   */
  describe("includeDrafts", () => {
    it("emits a row for a draft Post instead of skipping it", () => {
      const result = contentRowFor(
        "blog/a/a.en.md",
        post({ draft: true }),
        VOCABULARY,
        undefined,
        { includeDrafts: true },
      );

      expect(isSkipped(result)).toBe(false);
      expect(isInvalid(result)).toBe(false);
      expect((result as ContentRow).key).toBe("a:en");
    });

    it("emits a row for a draft Bookmark instead of skipping it", () => {
      const result = contentRowFor(
        "bookmarks/a.md",
        bookmark({ draft: true }),
        VOCABULARY,
        undefined,
        { includeDrafts: true },
      );

      expect(isSkipped(result)).toBe(false);
      expect((result as ContentRow).key).toBe("a:");
    });

    it("still skips a draft Post when the option is false", () => {
      const result = contentRowFor(
        "blog/a/a.en.md",
        post({ draft: true }),
        VOCABULARY,
        undefined,
        { includeDrafts: false },
      );

      expect(isSkipped(result)).toBe(true);
    });

    it("still fails a draft Post for every reason a published one would, drafts included", () => {
      const result = contentRowFor(
        "blog/a/a.en.md",
        post({ draft: true, tags: ["not-a-declared-tag"] }),
        VOCABULARY,
        undefined,
        { includeDrafts: true },
      );

      expect(isInvalid(result)).toBe(true);
    });

    it("does not affect a published Post — the same row either way", () => {
      const withoutOption = contentRowFor("blog/a/a.en.md", post(), VOCABULARY);
      const withOption = contentRowFor(
        "blog/a/a.en.md",
        post(),
        VOCABULARY,
        undefined,
        { includeDrafts: true },
      );

      expect((withoutOption as ContentRow).statement).toBe((withOption as ContentRow).statement);
    });
  });
});

describe("contentRowFor — Bookmarks", () => {
  it("emits an upsert keyed by Slug alone, with a null Locale", () => {
    const row = contentRowFor(
      "bookmarks/how-i-would-do-auth.md",
      bookmark(),
      VOCABULARY,
    ) as SeededRow;

    expect(row.key).toBe("how-i-would-do-auth:");
    expect(row.statement).toContain("'how-i-would-do-auth', NULL, 'link'");
  });

  it("carries the Source and external URL a Bookmark has", () => {
    const row = contentRowFor("bookmarks/a.md", bookmark(), VOCABULARY) as SeededRow;

    expect(row.statement).toContain("(slug, lang, type, title, external_url, source, published_at, updated_at)");
    expect(row.statement).toContain("'https://example.com/a', 'Example'");
  });

  /**
   * A Bookmark has no Locale to translate — it is a pointer, and the thing it
   * points at is not this repository's to translate. Before this a filename
   * ending `.en.md` would have seeded with `lang = 'en'` against the partial
   * unique index that assumes a Bookmark has none, and nothing would say so.
   */
  it("fails a Bookmark whose filename carries a Locale suffix", () => {
    const result = contentRowFor("bookmarks/how-i-would-do-auth.en.md", bookmark(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toContain("bookmarks/how-i-would-do-auth.en.md");
    expect((result as { error: string }).error).toMatch(/Locale suffix/);
  });

  /**
   * The two failures Part 1 introduces are told apart by their messages: a
   * Locale-bearing tree missing one reads differently from a Bookmark
   * carrying one it should not.
   */
  it("fails with a different message from a Post carrying no recognised Locale", () => {
    const missingLocale = contentRowFor(
      "blog/a/a.en-old.md",
      post(),
      VOCABULARY,
    ) as { error: string };
    const strayLocale = contentRowFor(
      "bookmarks/a.en.md",
      bookmark(),
      VOCABULARY,
    ) as { error: string };

    expect(missingLocale.error).toMatch(/no recognised Locale/);
    expect(strayLocale.error).toMatch(/carries a Locale suffix/);
    expect(missingLocale.error).not.toBe(strayLocale.error);
  });
});

/**
 * A Part is a Post with a Container. Everything that makes it one is written
 * here from the manifest's lists — a Part's own file says nothing about where
 * it sits (ADR 0007).
 */
describe("contentRowFor — Parts of a Series", () => {
  const partPath = "series/pragmatic-nodejs-api/project-setup/project-setup.en.md";
  const placement = { seriesSlug: "pragmatic-nodejs-api", section: "fundamentals", order: 1 };

  it("writes the Container the manifest supplies", () => {
    const row = contentRowFor(partPath, post(), VOCABULARY, placement) as SeededRow;

    expect(row.key).toBe("project-setup:en");
    expect(row.statement).toContain("'pragmatic-nodejs-api', 'fundamentals', NULL, 1, CURRENT_TIMESTAMP)");
  });

  /** Zero is a position, and a falsy one. It must survive the round trip. */
  it("writes the first Part's position rather than dropping it", () => {
    const row = contentRowFor(partPath, post(), VOCABULARY, {
      ...placement,
      order: 0,
    }) as SeededRow;

    expect(row.statement).toContain("'fundamentals', NULL, 0, CURRENT_TIMESTAMP)");
  });

  /**
   * What *writes both order columns with the same value* became. Its invariant
   * went with the column: `section_order` was written beside `container_order`,
   * unread, for the Worker still deployed during the rename's expand step, and
   * `0007` dropped it once that publication was live.
   *
   * What is left worth pinning is that there is no second copy at all — the
   * statement names one order column and carries one position. The
   * `not.toContain` is the load-bearing half; the position is asserted beside
   * it so the test cannot pass against a statement that writes nothing.
   */
  it("writes the position once, into the only order column left", () => {
    const row = contentRowFor(partPath, post(), VOCABULARY, {
      ...placement,
      order: 3,
    }) as SeededRow;

    expect(row.statement).toContain("'fundamentals', NULL, 3, CURRENT_TIMESTAMP)");
    expect(row.statement).not.toContain("section_order");
  });

  /**
   * The other half of *manifest and disk reconcile*: a Part nothing indexes
   * would be seeded with no Container, so no listing could link to it.
   */
  it("fails a Part its manifest does not list", () => {
    const result = contentRowFor(partPath, post(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/not listed in the pragmatic-nodejs-api manifest/);
  });

  /**
   * `en-old` is not a Locale, so this file fails on that before the manifest
   * is ever consulted — it is never a candidate for "not listed", because it
   * never earns a Locale to be listed under.
   */
  it("fails a Part with no recognised Locale rather than demanding the manifest list it", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en-old.md",
      post(),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/no recognised Locale/);
    expect((result as { error: string }).error).not.toMatch(/not listed in the/);
  });

  it("fails a Part declaring itself the Series it belongs to", () => {
    const result = contentRowFor(
      partPath,
      { ...post(), type: "series" as never },
      VOCABULARY,
      placement,
    );

    expect(isInvalid(result)).toBe(true);
  });

  it("fails a Series manifest handed to the content generator", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/pragmatic-nodejs-api.en.md",
      post(),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/does not belong in the content table/);
  });
});

/**
 * A Field Note is a Post whose Container is a Project — `PartPlacement`'s
 * sibling, `NotePlacement`, written from the Project manifest's flat list
 * rather than from an arc (Part 2 and Part 6 of the field notes).
 */
describe("contentRowFor — Field Notes of a Project", () => {
  const notePath = "projects/chekalo/product-matching/product-matching.en.md";
  const placement = { projectSlug: "chekalo", order: 0 };

  it("writes the Container the manifest supplies, with no Series columns", () => {
    const row = contentRowFor(notePath, post(), VOCABULARY, placement) as SeededRow;

    expect(row.key).toBe("product-matching:en");
    expect(row.statement).toContain("NULL, NULL, 'chekalo', 0, CURRENT_TIMESTAMP)");
  });

  /**
   * As a Part's is — and with a non-zero position, because the test above
   * uses zero and a generator that wrote `0` whatever the manifest said would
   * satisfy that one.
   */
  it("writes the position once, into the only order column left", () => {
    const row = contentRowFor(notePath, post(), VOCABULARY, {
      ...placement,
      order: 2,
    }) as SeededRow;

    expect(row.statement).toContain("'chekalo', 2, CURRENT_TIMESTAMP)");
    expect(row.statement).not.toContain("section_order");
  });

  /**
   * A note listed in the manifest while it is a Draft is accepted — the
   * Container check above already passed, because reconciliation does not
   * distinguish a Draft file from a published one (Part 9 of the field
   * notes) — and only then does it produce nothing.
   */
  it("skips a draft Field Note that is listed in its manifest, after the Container check passes", () => {
    const result = contentRowFor(notePath, post({ draft: true }), VOCABULARY, placement);

    expect(isSkipped(result)).toBe(true);
  });

  /**
   * The other half of *manifest and disk reconcile*: a note nothing indexes
   * would be seeded with no Container, so no listing could link to it.
   */
  it("fails a Field Note its manifest does not list", () => {
    const result = contentRowFor(notePath, post(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/not listed in the chekalo manifest/);
  });

  it("fails a Project handed to the content generator", () => {
    const result = contentRowFor("projects/chekalo/chekalo.en.md", post(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/does not belong in the content table/);
  });
});

describe("contentRowFor — anything else", () => {
  it("skips a filename it cannot parse at all", () => {
    const result = contentRowFor("blog/x/not-markdown.txt", post(), VOCABULARY);

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/could not parse/);
  });
});

/**
 * ADR 0004. These are failures, not skips: each one used to produce a row, a
 * page or a silence that looked like success.
 */
describe("contentRowFor — the tree and the front matter must agree", () => {
  it("fails a Post filed under bookmarks, which used to seed a row with no body", () => {
    const result = contentRowFor("bookmarks/value-objects.en.md", post(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/in the bookmarks tree says 'link'/);
  });

  it("fails a file declaring a type no tree holds", () => {
    const result = contentRowFor(
      "blog/x/x.en.md",
      { ...post(), type: "note" as never },
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
  });

  /** Invisible rather than misfiled: nothing would read it and nothing would say so. */
  it("fails a file under a directory no generator claims", () => {
    const result = contentRowFor("drafts/x.en.md", post(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/not under a content tree/);
  });

  it("fails a Project handed to the content generator", () => {
    const result = contentRowFor("projects/chekalo/chekalo.en.md", post(), VOCABULARY);

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/does not belong in the content table/);
  });
});

/**
 * The vocabulary arrives the way a Part's placement does — as a value the
 * generator read off the disk — so an undeclared Tag fails in the shape every
 * other front-matter mistake already fails in. What these assert is that it is a
 * failure at all: a warning printed by a run that already prints skip notices on
 * every pass is a warning nobody reads.
 */
describe("contentRowFor — Tags are drawn from the declared vocabulary", () => {
  it("seeds a Post whose Tags are all declared", () => {
    const result = contentRowFor(
      "blog/a/a.en.md",
      post({ tags: ["nodejs", "software-architecture"] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(false);
    // Against the rows, because the rows are where a declared Tag now lands.
    // This used to read the JSON copy on `content`, which said the same thing
    // about a column nothing queried.
    expect((result as ContentRow).tags.map((tag) => tag.key)).toEqual([
      "a:en:nodejs",
      "a:en:software-architecture",
    ]);
  });

  /**
   * The defect this closes: `architecture` and `software-architecture` are both
   * well-formed slugs, so no rule about shape rejects either, and the site
   * carried one subject under two words.
   */
  it("fails an undeclared Tag, naming the file, the Tag and where to declare it", () => {
    const result = contentRowFor(
      "blog/a/a.en.md",
      post({ tags: ["nodejs", "architecture"] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);

    const { error } = result as { error: string };
    expect(error).toContain("blog/a/a.en.md");
    expect(error).toContain("architecture");
    expect(error).toContain("app/content/tags.json");
  });

  /** Two mistakes, two messages: one is a rewrite, the other is a decision. */
  it("fails a Tag that is not a slug with a different message from an undeclared one", () => {
    const notASlug = contentRowFor(
      "blog/a/a.en.md",
      post({ tags: ["Software Architecture"] }),
      VOCABULARY,
    ) as { error: string };
    const undeclared = contentRowFor(
      "blog/a/a.en.md",
      post({ tags: ["architecture"] }),
      VOCABULARY,
    ) as { error: string };

    expect(notASlug.error).toMatch(/is not a slug/);
    expect(undeclared.error).toMatch(/does not declare/);
  });

  /** The vocabulary covers Bookmarks too, though no Tag page lists them. */
  it("fails an undeclared Tag on a Bookmark", () => {
    const result = contentRowFor(
      "bookmarks/a.md",
      bookmark({ tags: ["UX"] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
  });

  /**
   * The Locale check leads the Post branch, ahead of the Tag check — a file
   * with no recognised Locale fails on that even when its Tags would fail
   * too, so the error names the mistake actually in front of the reader
   * rather than a second one behind it.
   */
  it("fails a Post with no recognised Locale on that, even when its Tags are undeclared too", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en-old.md",
      post({ tags: ["Nodejs", "TypeScript"] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/no recognised Locale/);
  });
});

/**
 * The rows a Tag page will query, rather than every Content Item's parsed JSON
 * aggregated in JavaScript.
 *
 * Keyed on the natural key of the Content Item plus the Tag. `id_content` is an
 * autoincrement and this seed upserts with `INSERT OR REPLACE`, which deletes
 * and re-inserts on a conflict — so a row pointing at the id would point at a
 * different Content Item, or at nothing, after the next seed run.
 */
describe("contentRowFor — Tags become rows", () => {
  it("emits one row per Tag on a Post, keyed by (Slug, Locale, Tag)", () => {
    const row = contentRowFor(
      "blog/a/a.en.md",
      post({ tags: ["nodejs", "ddd"] }),
      VOCABULARY,
    ) as ContentRow;

    expect(row.tags.map((tag) => tag.key)).toEqual(["a:en:nodejs", "a:en:ddd"]);
    expect(row.tags[0].statement).toContain("INSERT OR REPLACE INTO content_tag (slug, lang, tag)");
    expect(row.tags[0].statement).toContain("VALUES ('a', 'en', 'nodejs')");
  });

  /**
   * `INSERT OR REPLACE` against the natural key, exactly as the `content` row
   * beside it. Losing it would turn a re-seed into duplicate rows and every
   * Tag count into a multiple of how often the seed has run.
   */
  it("upserts rather than inserting, so re-running the seed is a no-op", () => {
    const row = contentRowFor("blog/a/a.en.md", post(), VOCABULARY) as ContentRow;

    expect(row.tags[0].statement).toMatch(/INSERT OR REPLACE/);
    expect(row.tags[0].statement).not.toMatch(/^\s*INSERT INTO/m);
  });

  it("emits nothing for a Post that carries no Tags", () => {
    const row = contentRowFor("blog/a/a.en.md", post({ tags: undefined }), VOCABULARY) as ContentRow;

    expect(row.tags).toEqual([]);
  });

  /**
   * A Part's rows are a loose Post's rows. Where it sits is already on its
   * `content` row, and repeating it here would be a second place for it to be
   * wrong — while what a Tag page lists is a policy of the page, not of the
   * data.
   */
  it("gives a Part of a Series the same rows as a loose Post, with no trace of its Container", () => {
    const row = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en.md",
      post({ tags: ["nodejs"] }),
      VOCABULARY,
      { seriesSlug: "pragmatic-nodejs-api", section: "fundamentals", order: 1 },
    ) as ContentRow;

    expect(row.tags.map((tag) => tag.key)).toEqual(["project-setup:en:nodejs"]);
    expect(row.tags[0].statement).toContain("VALUES ('project-setup', 'en', 'nodejs')");
    expect(row.tags[0].statement).not.toContain("pragmatic-nodejs-api");
  });

  /**
   * Seeded although no Tag page lists a Bookmark today: the store is derived
   * from the Markdown, and which kinds a page shows is decided at render, so
   * reopening that question later needs no migration and no reseed.
   */
  it("writes a Bookmark's Tags with a null Locale", () => {
    const row = contentRowFor(
      "bookmarks/a.md",
      bookmark({ tags: ["backend"] }),
      VOCABULARY,
    ) as ContentRow;

    expect(row.tags.map((tag) => tag.key)).toEqual(["a::backend"]);
    expect(row.tags[0].statement).toContain("VALUES ('a', NULL, 'backend')");
  });
});

describe("contentRowFor — revisions", () => {
  it("stores an absent list as an empty array, not as NULL", () => {
    const row = contentRowFor("blog/a/a.en.md", post(), VOCABULARY) as SeededRow;

    expect(row.statement).toContain("updates, series_slug");
    expect(row.statement).toContain(`'[]'`);
  });

  it("stores the list newest first, whatever order the file used", () => {
    const row = contentRowFor(
      "blog/a/a.en.md",
      post({
        updates: [
          { date: "2026-01-01", note: "First revision." },
          { date: "2027-08-14", note: "Second revision." },
        ],
      }),
      VOCABULARY,
    ) as SeededRow;

    expect(row.statement).toContain(
      `'[{"date":"2027-08-14","note":"Second revision."},{"date":"2026-01-01","note":"First revision."}]'`,
    );
  });

  it("fails a malformed list rather than dating the page by its publication", () => {
    const result = contentRowFor(
      "blog/a/a.en.md",
      post({ updates: [{ note: "No date." }] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
  });

  /** A Bookmark's body lives at the Source; it is not yours to revise. */
  it("fails a Bookmark that declares updates", () => {
    const result = contentRowFor(
      "bookmarks/a.md",
      bookmark({ updates: [{ date: "2026-01-01", note: "x" }] }),
      VOCABULARY,
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/the body is not here/);
  });
});

/**
 * A Slug is unique across the whole site, not within a tree: `content` carries
 * one partial unique index on `(slug, lang)` and another on `(slug)`. Shortening
 * a Part's Slug is exactly the move that can collide with a loose Post.
 */
describe("duplicateKeys", () => {
  const row = (key: string): SeededRow => ({ key, statement: "" });

  it("names nothing when every Content Item claims its own identity", () => {
    expect(duplicateKeys([row("a:en"), row("b:en"), row("b:")])).toEqual([]);
  });

  it("names a Slug two files claim in the same Locale", () => {
    expect(duplicateKeys([row("project-setup:en"), row("project-setup:en")])).toEqual([
      "project-setup:en",
    ]);
  });

  it("names each collision once, however many files share it", () => {
    expect(duplicateKeys([row("a:en"), row("a:en"), row("a:en")])).toEqual(["a:en"]);
  });
});

describe("buildSeedSql", () => {
  const rows = (): ContentRow[] => [
    contentRowFor("blog/a/a.en.md", post(), VOCABULARY) as ContentRow,
    contentRowFor("bookmarks/b.md", bookmark({ tags: ["backend"] }), VOCABULARY) as ContentRow,
  ];

  /**
   * The order is the whole point. This file used to open with
   * `DELETE FROM content`, which on the remote database empties the live table
   * and serves an empty Timeline until the inserts land.
   */
  it("puts every insert before the prune", () => {
    const sql = buildSeedSql(rows());

    expect(sql.indexOf("INSERT OR REPLACE")).toBeLessThan(sql.indexOf("DELETE FROM content"));
    expect(sql).not.toMatch(/^\s*DELETE FROM content/);
  });

  it("prunes by identity, keeping every row a Markdown file still backs", () => {
    const sql = buildSeedSql(rows());

    expect(sql).toContain(
      "DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN ('a:en', 'b:')",
    );
  });

  it("never emits an unconditional delete", () => {
    const sql = buildSeedSql(rows());

    expect(sql).not.toMatch(/DELETE FROM content;/);
    expect(sql).not.toMatch(/DELETE FROM content WHERE 1/);
  });

  /**
   * With no rows the prune matches everything, so the statement empties the
   * table. `generate-seed-sql.ts` never reaches this — it returns early when it
   * finds no Markdown files — but the guard lives in the caller, not here, and
   * that is worth knowing before anyone calls this from somewhere else.
   */
  it("produces a table-emptying prune when given no rows at all", () => {
    expect(buildSeedSql([])).toContain("NOT IN ()");
  });

  /**
   * `content_tag` is seeded here rather than by a builder of its own: its rows
   * are the same reading of the same files, so they cannot drift into a Tag
   * left alive by a Content Item that is gone.
   */
  it("writes every Tag row before either prune", () => {
    const sql = buildSeedSql(rows());

    expect(sql.indexOf("INSERT OR REPLACE INTO content_tag")).toBeLessThan(
      sql.indexOf("DELETE FROM content"),
    );
    expect(sql).not.toMatch(/^\s*DELETE FROM content_tag/);
  });

  it("prunes Tag rows by (Slug, Locale, Tag), keeping every one a Markdown file still backs", () => {
    const sql = buildSeedSql(rows());

    expect(sql).toContain(
      "DELETE FROM content_tag WHERE slug || ':' || ifnull(lang, '') || ':' || tag NOT IN ('a:en:ddd', 'b::backend')",
    );
  });

  /**
   * The same shape with an empty list, which SQLite reads as matching every
   * row: with nothing carrying a Tag, no row in `content_tag` is backed. It is
   * still the closing statement, never a leading truncate.
   */
  it("empties content_tag when no Content Item carries a Tag", () => {
    const sql = buildSeedSql([
      contentRowFor("blog/a/a.en.md", post({ tags: [] }), VOCABULARY) as ContentRow,
    ]);

    expect(sql).toContain("DELETE FROM content_tag WHERE slug || ':' || ifnull(lang, '') || ':' || tag NOT IN ()");
    expect(sql).not.toMatch(/DELETE FROM content_tag;/);
  });
});
