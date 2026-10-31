import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findAllPosts, findLoosePosts } from "~/models/content.server";
import { findAllSeries, findSeriesArc, findSeriesBySlug } from "~/models/series.server";

import { openTestPlatform, type TestPlatform } from "../setup/platform";

/**
 * The Series queries against real D1, on the rows `seed/d1/seed.sql` produced.
 *
 * No Series is published any more, so what these assert is what the queries
 * answer over empty tables: nothing, and without failing. The projection of an
 * arc — sections in the order a manifest lists them, Parts in the order each
 * section lists them — is covered by `tests/unit/seed/series-sql.test.ts`,
 * which builds one from a manifest instead of reading it back.
 */

let platform: TestPlatform;

beforeAll(async () => {
  platform = await openTestPlatform();
});

afterAll(async () => {
  await platform?.dispose();
});

describe("findAllSeries", () => {
  it("returns an empty list when no Series is published", async () => {
    expect(await findAllSeries(platform.env.POSCHULER_BD, "en")).toEqual([]);
  });
});

describe("findSeriesBySlug", () => {
  it("returns null for a Slug with nothing behind it", async () => {
    expect(await findSeriesBySlug(platform.env.POSCHULER_BD, "no-such-series", "en")).toBeNull();
  });
});

describe("findSeriesArc", () => {
  it("returns nothing for a Series that does not exist", async () => {
    expect(await findSeriesArc(platform.env.POSCHULER_BD, "no-such-series", "en")).toEqual([]);
  });
});

/**
 * The split `/blog` depends on. A Part listed there individually would mean
 * publishing part nine lengthens the page instead of updating a row.
 */
describe("findLoosePosts", () => {
  it("excludes every Post that has a Container", async () => {
    const [loose, all] = await Promise.all([
      findLoosePosts(platform.env.POSCHULER_BD, "en"),
      findAllPosts(platform.env.POSCHULER_BD, "en"),
    ]);

    expect(loose.length).toBeGreaterThan(0);
    expect(loose.every((post) => post.seriesSlug === null)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(loose.length);
  });
});
