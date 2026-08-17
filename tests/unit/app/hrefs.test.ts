import { describe, expect, it } from "vitest";

import {
  navHref,
  postHref,
  projectHref,
  seriesHref,
  tagHref,
  withLocale,
} from "../../../app/lib/hrefs";

/**
 * Four lines with a test, because the rule they hold is the one that used to
 * live inline in `ContentItem` as `/blog/${item.slug}` — and the day a Part
 * moved under its Series, that line started producing a 404 from every list on
 * the site at once. 1b (`evolution-plan/14-phase-1b-field-notes.md`) adds the
 * third branch: a Field Note under its Project. Phase 3 (`evolution-plan/15`)
 * adds the Locale.
 */

describe("postHref", () => {
  it("serves a loose Post from /blog", () => {
    expect(postHref({ slug: "implementing-value-objects", seriesSlug: null }, "en")).toBe(
      "/blog/implementing-value-objects",
    );
  });

  it("serves a Part under its Series", () => {
    expect(
      postHref({ slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" }, "en"),
    ).toBe("/series/pragmatic-nodejs-api/project-setup");
  });

  it("serves a Field Note under its Project", () => {
    expect(
      postHref({ slug: "product-matching", seriesSlug: null, projectSlug: "chekalo" }, "en"),
    ).toBe("/projects/chekalo/product-matching");
  });

  /**
   * The two Container columns never both hold a value (`schema.sql`), so this
   * case never arises in practice — what it pins is that the function still
   * resolves to exactly one branch rather than to neither or to both.
   */
  it("resolves to the Series when handed both, rather than to neither", () => {
    expect(
      postHref(
        { slug: "x", seriesSlug: "pragmatic-nodejs-api", projectSlug: "chekalo" },
        "en",
      ),
    ).toBe("/series/pragmatic-nodejs-api/x");
  });

  /** Callers outside a Project's own note listing never pass `projectSlug` at all. */
  it("treats an absent projectSlug the same as null", () => {
    expect(
      postHref({ slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" }, "en"),
    ).toBe(
      postHref(
        { slug: "project-setup", seriesSlug: "pragmatic-nodejs-api", projectSlug: null },
        "en",
      ),
    );
  });

  /** The Slug never varies by Locale (ADR 0010); the segment gains `/es` in front of it. */
  it("prefixes a Spanish address with /es, at the same Slug", () => {
    expect(postHref({ slug: "implementing-value-objects", seriesSlug: null }, "es")).toBe(
      "/es/blog/implementing-value-objects",
    );
  });

  it("prefixes a Spanish Part through its already-prefixed Series", () => {
    expect(
      postHref({ slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" }, "es"),
    ).toBe("/es/series/pragmatic-nodejs-api/project-setup");
  });
});

describe("seriesHref", () => {
  it("points at the landing", () => {
    expect(seriesHref("pragmatic-nodejs-api", "en")).toBe("/series/pragmatic-nodejs-api");
  });

  it("points at the Spanish landing under /es", () => {
    expect(seriesHref("pragmatic-nodejs-api", "es")).toBe("/es/series/pragmatic-nodejs-api");
  });
});

describe("projectHref", () => {
  it("points at the landing", () => {
    expect(projectHref("chekalo", "en")).toBe("/projects/chekalo");
  });

  it("points at the Spanish landing under /es", () => {
    expect(projectHref("chekalo", "es")).toBe("/es/projects/chekalo");
  });
});

/**
 * The index builds one of these per entry and the chips on a Post will build
 * one each, so the rule lives in the same place the other two do rather than
 * inline at both call sites.
 */
describe("tagHref", () => {
  it("carries the Tag through verbatim, because a Tag is its Slug", () => {
    expect(tagHref("software-architecture", "en")).toBe("/tags/software-architecture");
  });

  it("prefixes the Spanish Tag page the same way", () => {
    expect(tagHref("software-architecture", "es")).toBe("/es/tags/software-architecture");
  });
});

/**
 * The generic case the four functions above build on: a page with no document
 * behind it, whose whole address is the literal path itself — `/blog`, `/tags`,
 * and the home page's `/`.
 */
describe("withLocale", () => {
  it("leaves an English path untouched", () => {
    expect(withLocale("/blog", "en")).toBe("/blog");
  });

  it("prefixes any other path with /es", () => {
    expect(withLocale("/blog", "es")).toBe("/es/blog");
  });

  /** `/es`, never `/es/` — confirmed against the generated route registry (ADR 0010). */
  it("localises the home page to exactly /es, with no trailing slash", () => {
    expect(withLocale("/", "es")).toBe("/es");
  });

  /**
   * The empty string, not `/`: composed as `${SITE}${path}` in
   * `app/lib/seo/alternates.ts`, this is what lands on `https://poschuler.com`
   * rather than on a trailing slash the site's own canonical has never
   * declared.
   */
  it("localises the English home page to the empty string", () => {
    expect(withLocale("/", "en")).toBe("");
  });
});

/**
 * The same rule for a `<Link to>`, and the one case where that is not the same
 * string. The empty string the test directly above pins is correct for an
 * address and wrong for a link: React Router reads an empty relative path as
 * the current location, so the 404 page's only way out rendered
 * `href="/the-address-that-404ed"` — in English, where `withLocale` returns
 * `""`, and only there, which is how it survived a phase spent on Spanish.
 */
describe("navHref", () => {
  it("sends the English home page to the root, not to the current location", () => {
    expect(navHref("/", "en")).toBe("/");
  });

  it("localises the home page the way withLocale does", () => {
    expect(navHref("/", "es")).toBe("/es");
  });

  it("is withLocale for every other path", () => {
    for (const path of ["/blog", "/series", "/tags", "/cv"]) {
      for (const locale of ["en", "es"] as const) {
        expect(navHref(path, locale)).toBe(withLocale(path, locale));
      }
    }
  });
});
