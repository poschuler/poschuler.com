import { describe, expect, it } from "vitest";

import { postHref, projectHref, seriesHref, tagHref } from "../../../app/lib/hrefs";

/**
 * Four lines with a test, because the rule they hold is the one that used to
 * live inline in `ContentItem` as `/blog/${item.slug}` — and the day a Part
 * moved under its Series, that line started producing a 404 from every list on
 * the site at once. 1b (`evolution-plan/14-phase-1b-field-notes.md`) adds the
 * third branch: a Field Note under its Project.
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

  it("serves a Field Note under its Project", () => {
    expect(
      postHref({ slug: "product-matching", seriesSlug: null, projectSlug: "chekalo" }),
    ).toBe("/projects/chekalo/product-matching");
  });

  /**
   * The two Container columns never both hold a value (`schema.sql`), so this
   * case never arises in practice — what it pins is that the function still
   * resolves to exactly one branch rather than to neither or to both.
   */
  it("resolves to the Series when handed both, rather than to neither", () => {
    expect(
      postHref({ slug: "x", seriesSlug: "pragmatic-nodejs-api", projectSlug: "chekalo" }),
    ).toBe("/series/pragmatic-nodejs-api/x");
  });

  /** Callers outside a Project's own note listing never pass `projectSlug` at all. */
  it("treats an absent projectSlug the same as null", () => {
    expect(postHref({ slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" })).toBe(
      postHref({ slug: "project-setup", seriesSlug: "pragmatic-nodejs-api", projectSlug: null }),
    );
  });
});

describe("seriesHref", () => {
  it("points at the landing", () => {
    expect(seriesHref("pragmatic-nodejs-api")).toBe("/series/pragmatic-nodejs-api");
  });
});

describe("projectHref", () => {
  it("points at the landing", () => {
    expect(projectHref("chekalo")).toBe("/projects/chekalo");
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
