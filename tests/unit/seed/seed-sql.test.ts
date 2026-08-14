import { describe, expect, it } from "vitest";

import {
  buildSeedSql,
  contentRowFor,
  escapeSql,
  isInvalid,
  isSkipped,
  parseContentFilename,
  type FrontMatterAttributes,
  type SeededRow,
} from "../../../seed/d1/seed-sql";

/**
 * What ends up in production D1. The seed runs unattended in CI against the one
 * live database, so the rules below are not formatting preferences — a wrong
 * `DELETE` here empties the Timeline.
 */

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
    const result = contentRowFor("blog/value-objects/value-objects.en.md", post());

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
    const row = contentRowFor("blog/value-objects/value-objects.en.md", post()) as SeededRow;

    expect(row.statement).toMatch(/INSERT OR REPLACE/);
    expect(row.statement).not.toMatch(/^\s*INSERT INTO/m);
  });

  it("carries the columns a Post has and none of the Bookmark ones", () => {
    const row = contentRowFor("blog/value-objects/value-objects.en.md", post()) as SeededRow;

    expect(row.statement).toContain("(slug, lang, type, title, description, published_at, tags, repository, updates, updated_at)");
    expect(row.statement).not.toContain("external_url");
  });

  it("serialises absent tags as an empty JSON array, not as NULL", () => {
    const row = contentRowFor("blog/x/x.en.md", post({ tags: undefined })) as SeededRow;

    expect(row.statement).toContain(`'[]'`);
  });

  /**
   * The `.en-old.md` draft in `app/content` hits this branch: `en-old` is not a
   * Locale the parser recognises, so a file declaring `type: post` arrives with
   * no Locale and produces no row and no KV key. It is skipped with a warning
   * nobody reads.
   */
  it("skips a Post whose filename carries no recognised Locale", () => {
    const result = contentRowFor("blog/setup-project/setup-project.en-old.md", post());

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toMatch(/must have a language/);
  });
});

describe("contentRowFor — Bookmarks", () => {
  it("emits an upsert keyed by Slug alone, with a null Locale", () => {
    const row = contentRowFor("bookmarks/how-i-would-do-auth.md", bookmark()) as SeededRow;

    expect(row.key).toBe("how-i-would-do-auth:");
    expect(row.statement).toContain("'how-i-would-do-auth', NULL, 'link'");
  });

  it("carries the Source and external URL a Bookmark has", () => {
    const row = contentRowFor("bookmarks/a.md", bookmark()) as SeededRow;

    expect(row.statement).toContain("(slug, lang, type, title, external_url, source, published_at, tags, updated_at)");
    expect(row.statement).toContain("'https://example.com/a', 'Example'");
  });
});

describe("contentRowFor — anything else", () => {
  it("skips a filename it cannot parse at all", () => {
    const result = contentRowFor("blog/x/not-markdown.txt", post());

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
    const result = contentRowFor("bookmarks/value-objects.en.md", post());

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/sits in the bookmarks tree/);
  });

  it("fails a file declaring a type no tree holds", () => {
    const result = contentRowFor("blog/x/x.en.md", { ...post(), type: "note" as never });

    expect(isInvalid(result)).toBe(true);
  });

  /** Invisible rather than misfiled: nothing would read it and nothing would say so. */
  it("fails a file under a directory no generator claims", () => {
    const result = contentRowFor("drafts/x.en.md", post());

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/not under a content tree/);
  });

  it("fails a Project handed to the content generator", () => {
    const result = contentRowFor("projects/chekalo/chekalo.en.md", post());

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/does not belong in the content table/);
  });
});

describe("contentRowFor — revisions", () => {
  it("stores an absent list as an empty array, not as NULL", () => {
    const row = contentRowFor("blog/a/a.en.md", post()) as SeededRow;

    expect(row.statement).toContain("updates, updated_at)");
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
    ) as SeededRow;

    expect(row.statement).toContain(
      `'[{"date":"2027-08-14","note":"Second revision."},{"date":"2026-01-01","note":"First revision."}]'`,
    );
  });

  it("fails a malformed list rather than dating the page by its publication", () => {
    const result = contentRowFor("blog/a/a.en.md", post({ updates: [{ note: "No date." }] }));

    expect(isInvalid(result)).toBe(true);
  });

  /** A Bookmark's body lives at the Source; it is not yours to revise. */
  it("fails a Bookmark that declares updates", () => {
    const result = contentRowFor(
      "bookmarks/a.md",
      bookmark({ updates: [{ date: "2026-01-01", note: "x" }] }),
    );

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/the body is not here/);
  });
});

describe("buildSeedSql", () => {
  const rows = (): SeededRow[] => [
    contentRowFor("blog/a/a.en.md", post()) as SeededRow,
    contentRowFor("bookmarks/b.md", bookmark()) as SeededRow,
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
});
