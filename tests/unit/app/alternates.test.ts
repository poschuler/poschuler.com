import { describe, expect, it } from "vitest";

import { documentAddresses } from "~/lib/seo/alternates";

/**
 * The one source both the page `<head>` and the sitemap read. What matters
 * here is not the shape of any one address — `hrefs.test.ts` already pins
 * that — but that the three fields agree with each other and with
 * `existingLocales`, because that agreement is the whole reason this module
 * exists rather than three call sites each reconstructing the rule.
 */

describe("documentAddresses — a Post", () => {
  const post = {
    kind: "post" as const,
    slug: "implementing-value-objects",
    seriesSlug: null,
  };

  it("canonicalises the page at its own Locale", () => {
    const { canonical } = documentAddresses(post, "en", ["en"]);

    expect(canonical).toBe("https://poschuler.com/blog/implementing-value-objects");
  });

  it("declares only the Locale that exists, never one that does not", () => {
    const { alternates } = documentAddresses(post, "en", ["en"]);

    expect(alternates).toEqual([
      { locale: "en", href: "https://poschuler.com/blog/implementing-value-objects" },
    ]);
  });

  it("adds the reciprocal alternate once a Translation exists", () => {
    const { alternates } = documentAddresses(post, "en", ["en", "es"]);

    expect(alternates).toEqual([
      { locale: "en", href: "https://poschuler.com/blog/implementing-value-objects" },
      { locale: "es", href: "https://poschuler.com/es/blog/implementing-value-objects" },
    ]);
  });

  it("names the English address as the default, from either Locale", () => {
    expect(documentAddresses(post, "en", ["en", "es"]).xDefault).toBe(
      "https://poschuler.com/blog/implementing-value-objects",
    );
    expect(documentAddresses(post, "es", ["en", "es"]).xDefault).toBe(
      "https://poschuler.com/blog/implementing-value-objects",
    );
  });

  it("canonicalises the Spanish page under /es, at the same Slug", () => {
    const { canonical } = documentAddresses(post, "es", ["en", "es"]);

    expect(canonical).toBe("https://poschuler.com/es/blog/implementing-value-objects");
  });

  it("carries a Part's address through its Series", () => {
    const part = {
      kind: "post" as const,
      slug: "project-setup",
      seriesSlug: "pragmatic-nodejs-api",
    };

    expect(documentAddresses(part, "en", ["en"]).canonical).toBe(
      "https://poschuler.com/series/pragmatic-nodejs-api/project-setup",
    );
  });

  it("carries a Field Note's address through its Project", () => {
    const note = {
      kind: "post" as const,
      slug: "product-matching",
      seriesSlug: null,
      projectSlug: "chekalo",
    };

    expect(documentAddresses(note, "en", ["en"]).canonical).toBe(
      "https://poschuler.com/projects/chekalo/product-matching",
    );
  });
});

describe("documentAddresses — a Series landing", () => {
  it("canonicalises at the landing's own address", () => {
    const { canonical } = documentAddresses(
      { kind: "series", slug: "pragmatic-nodejs-api" },
      "en",
      ["en"],
    );

    expect(canonical).toBe("https://poschuler.com/series/pragmatic-nodejs-api");
  });
});

describe("documentAddresses — a Project landing", () => {
  it("canonicalises at the landing's own address", () => {
    const { canonical } = documentAddresses({ kind: "project", slug: "chekalo" }, "en", ["en"]);

    expect(canonical).toBe("https://poschuler.com/projects/chekalo");
  });
});

describe("documentAddresses — an index", () => {
  /**
   * Both, always (Part 6): an index page exists in every Locale regardless of
   * what has been translated, because it is the route that has no content of
   * its own to be missing.
   */
  it("declares both Locales, unconditionally", () => {
    const { alternates } = documentAddresses({ kind: "index", path: "/blog" }, "en", [
      "en",
      "es",
    ]);

    expect(alternates.map((alternate) => alternate.locale)).toEqual(["en", "es"]);
  });

  it("canonicalises the home page at the bare origin", () => {
    expect(documentAddresses({ kind: "index", path: "/" }, "en", ["en"]).canonical).toBe(
      "https://poschuler.com",
    );
  });

  it("canonicalises the Spanish home page at /es, not /es/", () => {
    expect(documentAddresses({ kind: "index", path: "/" }, "es", ["en", "es"]).canonical).toBe(
      "https://poschuler.com/es",
    );
  });
});
