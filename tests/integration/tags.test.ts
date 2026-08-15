import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbQuery } from "~/db.server";
import { findAllBookmarks, findAllPosts } from "~/models/content.server";
import { findPostsByTag } from "~/models/tag.server";

import { openTestPlatform, type TestPlatform } from "../setup/platform";

/**
 * The Tag queries against real D1, on the rows `seed/d1/seed.sql` produced.
 *
 * What these assert is the projection, not the SQL: the front matter carries
 * the Tags, the generator writes one row per Tag per Content Item, and what has
 * to be true here is that reading it back yields the Posts that carry it — in
 * the order a reader meets them, and without the Bookmarks that carry it too.
 *
 * The three Tags below are named rather than derived, because they are the
 * fixture: `app/content/tags.json` declares the vocabulary and the content
 * decides which Tags a Post carries. If either changes so that `webdev` reaches
 * a Post or `typescript` stops crossing the two kinds, these should fail and be
 * re-pointed on purpose.
 */

/** Carried by Posts alone. */
const POST_TAG = "nodejs";
/** Declared, carried by Bookmarks alone, and therefore backing no page. */
const BOOKMARK_ONLY_TAG = "webdev";
/** The one Tag that crosses the two kinds of Content Item. */
const CROSSING_TAG = "typescript";

let platform: TestPlatform;

beforeAll(async () => {
  platform = await openTestPlatform();
});

afterAll(async () => {
  await platform?.dispose();
});

describe("findPostsByTag", () => {
  it("returns the Posts carrying the Tag, and only Posts the table holds", async () => {
    const [tagged, posts] = await Promise.all([
      findPostsByTag(platform.env.POSCHULER_BD, POST_TAG),
      findAllPosts(platform.env.POSCHULER_BD),
    ]);

    expect(tagged.length).toBeGreaterThan(1);
    expect(tagged.every((post) => post.type === "post")).toBe(true);

    const published = posts.map((post) => post.slug);
    expect(tagged.every((post) => published.includes(post.slug))).toBe(true);

    // The primary key is `(slug, lang, tag)`, so the join can multiply nothing.
    expect(new Set(tagged.map((post) => post.slug)).size).toBe(tagged.length);
  });

  it("orders them newest first, the way every list on this site does", async () => {
    const tagged = await findPostsByTag(platform.env.POSCHULER_BD, POST_TAG);
    const dates = tagged.map((post) => post.publishedAt);

    expect(dates.length).toBeGreaterThan(1);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  /**
   * A declared Tag that only Bookmarks carry backs no page: the vocabulary says
   * what may be written, the content decides what exists. Twelve of the
   * twenty-two declared Tags are in this state today.
   */
  it("returns nothing for a Tag no Post carries", async () => {
    expect(await findPostsByTag(platform.env.POSCHULER_BD, BOOKMARK_ONLY_TAG)).toEqual([]);
  });

  it("returns nothing for a Tag that was never declared", async () => {
    expect(await findPostsByTag(platform.env.POSCHULER_BD, "no-such-tag")).toEqual([]);
  });

  /**
   * The one that would be silent if it broke. `content_tag` holds rows for
   * Bookmarks as well, so the filter is the only thing keeping them off this
   * page — and `CONTEXT.md` says the Timeline is the only place the two kinds
   * appear together.
   */
  it("keeps the Bookmarks carrying the same Tag out of the results", async () => {
    const [tagged, bookmarks, crossing] = await Promise.all([
      findPostsByTag(platform.env.POSCHULER_BD, CROSSING_TAG),
      findAllBookmarks(platform.env.POSCHULER_BD),
      // The precondition, read from the table rather than assumed: without it
      // every assertion below still holds the day nothing crosses any more, and
      // the test would go on passing while covering nothing.
      dbQuery<{ slug: string }>(
        platform.env.POSCHULER_BD,
        "select slug from content_tag where tag = ? and lang is null",
        [CROSSING_TAG],
      ),
    ]);

    expect(crossing.length).toBeGreaterThan(0);
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.every((post) => post.type === "post")).toBe(true);

    const bookmarked = new Set(bookmarks.map((bookmark) => bookmark.slug));
    expect(crossing.every((row) => bookmarked.has(row.slug))).toBe(true);
    expect(tagged.some((post) => bookmarked.has(post.slug))).toBe(false);
  });
});
