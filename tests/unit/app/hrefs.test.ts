import { describe, expect, it } from "vitest";

import { postHref, seriesHref, tagHref } from "../../../app/lib/hrefs";

/**
 * Four lines with a test, because the rule they hold is the one that used to
 * live inline in `ContentItem` as `/blog/${item.slug}` — and the day a Part
 * moved under its Series, that line started producing a 404 from every list on
 * the site at once.
 */

describe("postHref", () => {
  it("serves a loose Post from /blog", () => {
    expect(postHref({ slug: "implementing-value-objects", seriesSlug: null })).toBe(
      "/blog/implementing-value-objects",
    );
  });

  it("serves a Part under its Series", () => {
    expect(postHref({ slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" })).toBe(
      "/series/pragmatic-nodejs-api/project-setup",
    );
  });
});

describe("seriesHref", () => {
  it("points at the landing", () => {
    expect(seriesHref("pragmatic-nodejs-api")).toBe("/series/pragmatic-nodejs-api");
  });
});

/**
 * The index builds one of these per entry and the chips on a Post will build
 * one each, so the rule lives in the same place the other two do rather than
 * inline at both call sites.
 */
describe("tagHref", () => {
  it("carries the Tag through verbatim, because a Tag is its Slug", () => {
    expect(tagHref("software-architecture")).toBe("/tags/software-architecture");
  });
});
