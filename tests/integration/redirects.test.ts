import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PERMANENT_REDIRECTS } from "~/lib/redirects";
import { findPostBySlug } from "~/models/content.server";
import { findSeriesArc, findSeriesBySlug } from "~/models/series.server";

import { openTestPlatform, type TestPlatform } from "../setup/platform";

/**
 * Check 8 of the generator's list, written as a test because it is the only
 * one that crosses two sources: the redirect map, which is code, and the rows,
 * which are generated from the content tree.
 *
 * **A 301 pointing at a 404 is worse than no redirect.** The reader gets
 * nothing and the search engine drops the URL instead of moving it — and that
 * is not the failure of the day the map is written. It is the failure of the
 * day someone renames a Slug months later and has no reason to open this file.
 * Nothing else in the build can see it: the map type-checks against no
 * database, and the seed knows nothing about history.
 */

let platform: TestPlatform;

beforeAll(async () => {
  platform = await openTestPlatform();
});

afterAll(async () => {
  await platform?.dispose();
});

/** Whether the site can actually answer this path with a document. */
async function destinationExists(db: D1Database, path: string): Promise<boolean> {
  const segments = path.split("?")[0].split("/").filter(Boolean);

  if (segments[0] === "blog" && segments.length === 2) {
    const post = await findPostBySlug(db, segments[1], "en");

    // A Post with a Container does not answer at `/blog/<slug>` — it redirects
    // — so a map aimed there would be a chain, which is the other rule.
    return post !== null && post.seriesSlug === null;
  }

  if (segments[0] === "series" && segments.length === 2) {
    return (await findSeriesBySlug(db, segments[1], "en")) !== null;
  }

  if (segments[0] === "series" && segments.length === 3) {
    const sections = await findSeriesArc(db, segments[1], "en");

    return sections.some((section) => section.parts.some((part) => part.slug === segments[2]));
  }

  throw new Error(
    `${path} is not a shape this check knows how to verify — teach it before adding the entry`,
  );
}

describe("every redirect destination", () => {
  it("is a document the database actually holds", async () => {
    for (const [from, to] of Object.entries(PERMANENT_REDIRECTS)) {
      expect(await destinationExists(platform.env.POSCHULER_BD, to), `${from} → ${to}`).toBe(true);
    }
  });

  /**
   * The inverse, and the reason the map exists at all: what it moves away from
   * has to be gone. A source still serving content means two addresses for one
   * document, and the redirect would be hiding the live one.
   */
  it("replaces an address the database no longer holds", async () => {
    for (const from of Object.keys(PERMANENT_REDIRECTS)) {
      const slug = from.split("/").filter(Boolean)[1];

      expect(await findPostBySlug(platform.env.POSCHULER_BD, slug, "en"), from).toBeNull();
    }
  });
});
