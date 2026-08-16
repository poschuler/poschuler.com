import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findAllBookmarks, findAllPosts, mergeTimeline } from "~/models/content.server";

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

describe("findAllPosts", () => {
  it("returns only Posts, and every one carries a Locale", async () => {
    const posts = await findAllPosts(platform.env.POSCHULER_BD, "en");

    expect(posts.length).toBeGreaterThan(0);

    for (const post of posts) {
      expect(post.type).toBe("post");
      expect(post.lang).toBe("en");
    }
  });

  /**
   * The flat row type this replaced let a Post's `source` type-check as a
   * `string` while being `NULL`. The union encodes the split; this checks the
   * data does too.
   */
  it("leaves the Bookmark-only columns null", async () => {
    const posts = await findAllPosts(platform.env.POSCHULER_BD, "en");

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

describe("mergeTimeline", () => {
  it("interleaves both kinds of Content Item, newest first", async () => {
    const [posts, bookmarks] = await Promise.all([
      findAllPosts(platform.env.POSCHULER_BD, "en"),
      findAllBookmarks(platform.env.POSCHULER_BD),
    ]);

    const items = mergeTimeline(posts, bookmarks);

    expect(items.some((item) => item.type === "post")).toBe(true);
    expect(items.some((item) => item.type === "link")).toBe(true);

    const dates = items.map((item) => item.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("accounts for every row as either a Post or a Bookmark", async () => {
    const [posts, bookmarks] = await Promise.all([
      findAllPosts(platform.env.POSCHULER_BD, "en"),
      findAllBookmarks(platform.env.POSCHULER_BD),
    ]);

    expect(mergeTimeline(posts, bookmarks).length).toBe(posts.length + bookmarks.length);
  });
});

/**
 * The fixtures carry no Spanish Post — `seed/d1/seed.sql` is generated from
 * `app/content/`, which is English only today — so the Locale filter these
 * three queries gained is exercised by inserting a Translation directly, the
 * way `content.test.ts` already inserts rows to exercise a constraint, and
 * removing it again in `afterAll`.
 */
describe("with a Spanish Translation present", () => {
  /** An existing English Post's Slug, translated — `(Slug, Locale)` allows it. */
  let translatedSlug: string;

  beforeAll(async () => {
    const [enPost] = await findAllPosts(platform.env.POSCHULER_BD, "en");
    translatedSlug = enPost.slug;

    await platform.env.POSCHULER_BD.prepare(
      `insert into content (slug, lang, type, title, published_at)
        values (?, 'es', 'post', 'Traducción de prueba', '2026-01-01')`,
    )
      .bind(translatedSlug)
      .run();
  });

  afterAll(async () => {
    await platform.env.POSCHULER_BD.prepare("delete from content where slug = ? and lang = 'es'")
      .bind(translatedSlug)
      .run();
  });

  it("lists the Translation once in its own Locale's Posts, and not in the other's", async () => {
    const [enPosts, esPosts] = await Promise.all([
      findAllPosts(platform.env.POSCHULER_BD, "en"),
      findAllPosts(platform.env.POSCHULER_BD, "es"),
    ]);

    expect(esPosts.filter((post) => post.slug === translatedSlug)).toHaveLength(1);
    expect(enPosts.filter((post) => post.slug === translatedSlug)).toHaveLength(1);

    // Neither list holds two rows for the same Slug — the equality is on
    // `lang`, not on the Slug alone.
    expect(esPosts.filter((post) => post.slug === translatedSlug)[0].lang).toBe("es");
  });

  it("keeps every Bookmark in both Locales' Timelines", async () => {
    const bookmarks = await findAllBookmarks(platform.env.POSCHULER_BD);
    const [enPosts, esPosts] = await Promise.all([
      findAllPosts(platform.env.POSCHULER_BD, "en"),
      findAllPosts(platform.env.POSCHULER_BD, "es"),
    ]);

    const enTimeline = mergeTimeline(enPosts, bookmarks);
    const esTimeline = mergeTimeline(esPosts, bookmarks);

    for (const bookmark of bookmarks) {
      expect(enTimeline.some((item) => item.idContent === bookmark.idContent)).toBe(true);
      expect(esTimeline.some((item) => item.idContent === bookmark.idContent)).toBe(true);
    }
  });

  it("never lists the Translation twice in one Locale's Timeline", async () => {
    const bookmarks = await findAllBookmarks(platform.env.POSCHULER_BD);
    const esPosts = await findAllPosts(platform.env.POSCHULER_BD, "es");
    const esTimeline = mergeTimeline(esPosts, bookmarks);

    expect(esTimeline.filter((item) => item.slug === translatedSlug)).toHaveLength(1);
  });
});

describe("the schema enforces identity", () => {
  it("rejects a second Post with the same Slug and Locale", async () => {
    const insert = platform.env.POSCHULER_BD.prepare(
      "insert into content (slug, lang, type, title, published_at) values (?, 'en', 'post', 'Duplicate', '2026-01-01')",
    );

    const [{ slug }] = await findAllPosts(platform.env.POSCHULER_BD, "en");

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
