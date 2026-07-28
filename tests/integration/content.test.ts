import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findAll, findAllBookmarks, findAllPosts } from "~/models/content.server";

import { openTestPlatform, type TestPlatform } from "../setup/platform";

/**
 * Against real D1, not a mock: the queries run through Miniflare's SQLite, so
 * the partial unique indexes and the `CHECK` behave exactly as they do at the
 * edge. The rows come from `seed/d1/seed.sql` — the same fixture CI and the
 * smoke test use.
 *
 * What these assert is the domain model, not the SQL: a Post is identified by
 * `(Slug, Locale)` and carries a Locale; a Bookmark is identified by Slug alone
 * and carries a Source. The union type says so; this says the database agrees.
 */

let platform: TestPlatform;

beforeAll(async () => {
  platform = await openTestPlatform();
});

afterAll(async () => {
  await platform?.dispose();
});

describe("findAll — the Timeline", () => {
  it("returns both kinds of Content Item", async () => {
    const items = await findAll(platform.env.POSCHULER_BD);

    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.type === "post")).toBe(true);
    expect(items.some((item) => item.type === "link")).toBe(true);
  });

  it("orders them newest first", async () => {
    const items = await findAll(platform.env.POSCHULER_BD);
    const dates = items.map((item) => item.publishedAt);

    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("exposes a date already truncated to YYYY-MM-DD", async () => {
    const [first] = await findAll(platform.env.POSCHULER_BD);

    expect(first.publishedStringDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accounts for every row as either a Post or a Bookmark", async () => {
    const [all, posts, bookmarks] = await Promise.all([
      findAll(platform.env.POSCHULER_BD),
      findAllPosts(platform.env.POSCHULER_BD),
      findAllBookmarks(platform.env.POSCHULER_BD),
    ]);

    expect(posts.length + bookmarks.length).toBe(all.length);
  });
});

describe("findAllPosts", () => {
  it("returns only Posts, and every one carries a Locale", async () => {
    const posts = await findAllPosts(platform.env.POSCHULER_BD);

    expect(posts.length).toBeGreaterThan(0);

    for (const post of posts) {
      expect(post.type).toBe("post");
      expect(post.lang).toBeTruthy();
    }
  });

  /**
   * The flat row type this replaced let a Post's `source` type-check as a
   * `string` while being `NULL`. The union encodes the split; this checks the
   * data does too.
   */
  it("leaves the Bookmark-only columns null", async () => {
    const posts = await findAllPosts(platform.env.POSCHULER_BD);

    for (const post of posts) {
      expect(post.externalUrl).toBeNull();
      expect(post.source).toBeNull();
    }
  });
});

describe("findAllBookmarks", () => {
  it("returns only Bookmarks, each with a Source and an external URL", async () => {
    const bookmarks = await findAllBookmarks(platform.env.POSCHULER_BD);

    expect(bookmarks.length).toBeGreaterThan(0);

    for (const bookmark of bookmarks) {
      expect(bookmark.type).toBe("link");
      expect(bookmark.externalUrl).toBeTruthy();
      expect(bookmark.source).toBeTruthy();
    }
  });

  it("carries no Locale — a pointer is not translated", async () => {
    const bookmarks = await findAllBookmarks(platform.env.POSCHULER_BD);

    for (const bookmark of bookmarks) {
      expect(bookmark.lang).toBeNull();
    }
  });
});

describe("the schema enforces identity", () => {
  it("rejects a second Post with the same Slug and Locale", async () => {
    const insert = platform.env.POSCHULER_BD.prepare(
      "insert into content (slug, lang, type, title, published_at) values (?, 'en', 'post', 'Duplicate', '2026-01-01')",
    );

    const [{ slug }] = await findAllPosts(platform.env.POSCHULER_BD);

    await expect(insert.bind(slug).run()).rejects.toThrow();
  });

  it("rejects a Post with no Locale", async () => {
    await expect(
      platform.env.POSCHULER_BD.prepare(
        "insert into content (slug, type, title, published_at) values ('no-locale', 'post', 'No locale', '2026-01-01')",
      ).run(),
    ).rejects.toThrow();
  });
});
