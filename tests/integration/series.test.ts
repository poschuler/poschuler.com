import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findAllPosts, findLoosePosts } from "~/models/content.server";
import { findAllSeries, findSeriesArc, findSeriesBySlug } from "~/models/series.server";

import { openTestPlatform, type TestPlatform } from "../setup/platform";

/**
 * The Series queries against real D1, on the rows `seed/d1/seed.sql` produced.
 *
 * What these assert is the projection, not the SQL: the manifest declares the
 * arc and the generator writes it down as positions (ADR 0007), so what has to
 * be true here is that reading it back yields the same arc — sections in the
 * order the file lists them, Parts in the order each section lists them, and
 * a section with nothing published still present.
 */

let platform: TestPlatform;
let seriesSlug: string;

beforeAll(async () => {
  platform = await openTestPlatform();

  const [first] = await findAllSeries(platform.env.POSCHULER_BD);
  seriesSlug = first.slug;
});

afterAll(async () => {
  await platform?.dispose();
});

describe("findAllSeries", () => {
  it("hydrates the contract, including the list of what is out of scope", async () => {
    const [first] = await findAllSeries(platform.env.POSCHULER_BD);

    expect(first.startingPoint).toBeTruthy();
    expect(first.destination).toBeTruthy();
    expect(first.audience).toBeTruthy();
    expect(Array.isArray(first.outOfScope)).toBe(true);
    expect(first.outOfScope.length).toBeGreaterThan(0);
  });

  /**
   * The count and the date are answers about the Parts, computed at query time.
   * A column on `series` would be a second source of truth that the next seed
   * could leave behind.
   */
  it("counts the Parts it actually holds and dates itself by the newest", async () => {
    const [first] = await findAllSeries(platform.env.POSCHULER_BD);
    const posts = await findAllPosts(platform.env.POSCHULER_BD);
    const parts = posts.filter((post) => post.seriesSlug === first.slug);

    expect(first.partCount).toBe(parts.length);
    expect(first.publishedAt).toBe(
      parts.map((part) => part.publishedAt).sort().reverse()[0],
    );
  });
});

describe("findSeriesBySlug", () => {
  it("returns null for a Slug with nothing behind it", async () => {
    expect(await findSeriesBySlug(platform.env.POSCHULER_BD, "no-such-series")).toBeNull();
  });

  it("declares a status the reader can act on", async () => {
    const series = await findSeriesBySlug(platform.env.POSCHULER_BD, seriesSlug);

    expect(["ongoing", "complete"]).toContain(series?.status);
  });
});

describe("findSeriesArc", () => {
  it("returns every section, planned ones included", async () => {
    const sections = await findSeriesArc(platform.env.POSCHULER_BD, seriesSlug);

    expect(sections.length).toBeGreaterThan(1);
    expect(sections.some((section) => section.parts.length === 0)).toBe(true);
    expect(sections.every((section) => section.summary.trim() !== "")).toBe(true);
  });

  it("gives every Part a title and a date, and no duplicates across sections", async () => {
    const sections = await findSeriesArc(platform.env.POSCHULER_BD, seriesSlug);
    const parts = sections.flatMap((section) => section.parts);

    expect(parts.length).toBeGreaterThan(0);
    expect(new Set(parts.map((part) => part.slug)).size).toBe(parts.length);

    for (const part of parts) {
      expect(part.title.trim()).not.toBe("");
      expect(part.publishedStringDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("holds every Part the content table assigns to this Series", async () => {
    const sections = await findSeriesArc(platform.env.POSCHULER_BD, seriesSlug);
    const posts = await findAllPosts(platform.env.POSCHULER_BD);

    const inArc = sections.flatMap((section) => section.parts.map((part) => part.slug)).sort();
    const inTable = posts
      .filter((post) => post.seriesSlug === seriesSlug)
      .map((post) => post.slug)
      .sort();

    expect(inArc).toEqual(inTable);
  });

  it("returns nothing for a Series that does not exist", async () => {
    expect(await findSeriesArc(platform.env.POSCHULER_BD, "no-such-series")).toEqual([]);
  });
});

/**
 * The split `/blog` depends on. A Part listed there individually would mean
 * publishing part nine lengthens the page instead of updating a row.
 */
describe("findLoosePosts", () => {
  it("excludes every Post that has a Container", async () => {
    const [loose, all] = await Promise.all([
      findLoosePosts(platform.env.POSCHULER_BD),
      findAllPosts(platform.env.POSCHULER_BD),
    ]);

    expect(loose.length).toBeGreaterThan(0);
    expect(loose.every((post) => post.seriesSlug === null)).toBe(true);
    expect(loose.length).toBeLessThan(all.length);
  });
});
