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
   * Only `en` and `es` count as a Locale, so `en-old` is absorbed into the slug.
   * This is the mechanism behind the unpublished draft below.
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

    expect(row.statement).toContain("(slug, lang, type, title, description, published_at, tags, repository, updates, series_slug, series_section, section_order, updated_at)");
    expect(row.statement).not.toContain("external_url");
  });

  /**
   * The Container columns travel together or not at all, which is why nothing
   * checks that they do: a loose Post is written with three NULLs rather than
   * with the columns omitted, so a Post that leaves a Series cannot keep half
   * of one.
   */
  it("writes a loose Post with no Container rather than with none of the columns", () => {
    const row = contentRowFor(
      "blog/value-objects/value-objects.en.md",
      post(),
      VOCABULARY,
    ) as SeededRow;

    expect(row.statement).toContain("'[]', NULL, NULL, NULL, CURRENT_TIMESTAMP)");
  });

  it("serialises absent tags as an empty JSON array, not as NULL", () => {
    const row = contentRowFor(
      "blog/x/x.en.md",
      post({ tags: undefined }),
      VOCABULARY,
    ) as SeededRow;

    expect(row.statement).toContain(`'[]'`);
  });

  /**
   * The `.en-old.md` draft in `app/content` hits this branch: `en-old` is not a
   * Locale the parser recognises, so a file declaring `type: post` arrives with
   * no Locale and produces no row and no KV key. It is skipped with a warning
   * nobody reads.
   */
  it("skips a Post whose filename carries no recognised Locale", () => {
    const result = contentRowFor(
      "blog/setup-project/setup-project.en-old.md",
      post(),
      VOCABULARY,
    );

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/must have a language/);
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

    expect(row.statement).toContain("(slug, lang, type, title, external_url, source, published_at, tags, updated_at)");
    expect(row.statement).toContain("'https://example.com/a', 'Example'");
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
    expect(row.statement).toContain("'pragmatic-nodejs-api', 'fundamentals', 1, CURRENT_TIMESTAMP)");
  });

  /** Zero is a position, and a falsy one. It must survive the round trip. */
  it("writes the first Part's position rather than dropping it", () => {
    const row = contentRowFor(partPath, post(), VOCABULARY, {
      ...placement,
      order: 0,
    }) as SeededRow;

    expect(row.statement).toContain("'fundamentals', 0, CURRENT_TIMESTAMP)");
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
   * The draft beside part one. It stays unpublished because `en-old` is not a
   * Locale — which used to hold by accident, and is the one file that must be
   * skipped rather than failed for being absent from the manifest.
   */
  it("skips a draft inside a Series instead of demanding the manifest list it", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en-old.md",
      post(),
      VOCABULARY,
    );

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/must have a language/);
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
    expect((result as SeededRow).statement).toContain(`'["nodejs","software-architecture"]'`);
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
   * The one file no check can see. `project-setup.en-old.md` carries the
   * pre-vocabulary spellings and is skipped for its filename before its Tags are
   * ever read — so it stays invalid and unchecked, and becomes a build failure
   * the moment anyone renames it.
   */
  it("skips a draft carrying pre-vocabulary Tags rather than failing on them", () => {
    const result = contentRowFor(
      "series/pragmatic-nodejs-api/project-setup/project-setup.en-old.md",
      post({ tags: ["Nodejs", "TypeScript"] }),
      VOCABULARY,
    );

    expect(isSkipped(result)).toBe(true);
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
