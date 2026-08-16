import { describe, expect, it } from "vitest";

import { documentAddresses, emptyIndexRobots, switcherDestination } from "~/lib/seo/alternates";

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

/**
 * The one directive `/blog`, `/projects`, `/series` and `/tags` all add to
 * their own `meta` when their own list is empty (Part 6 of
 * `evolution-plan/15-phase-3-spanish.md`) — shared here so the four route
 * files spread the same array rather than typing the same conditional out
 * four times.
 */
describe("emptyIndexRobots", () => {
  it("adds noindex, follow when the list is empty", () => {
    expect(emptyIndexRobots(true)).toEqual([{ name: "robots", content: "noindex, follow" }]);
  });

  it("adds nothing when the list is not empty", () => {
    expect(emptyIndexRobots(false)).toEqual([]);
  });
});

/**
 * The language switcher's own destination (Part 9 of
 * `evolution-plan/15-phase-3-spanish.md`), for every page kind the table
 * there names. `existingLocales` is always the same value a caller's own
 * `documentAddresses` call already received — never a second query — which is
 * what these tests hand it too.
 */
describe("switcherDestination — a document with a Translation", () => {
  const post = { kind: "post" as const, slug: "implementing-value-objects", seriesSlug: null };

  it("goes to that document, in the other Locale", () => {
    expect(switcherDestination(post, "en", ["en", "es"])).toEqual({
      href: "/es/blog/implementing-value-objects",
      locale: "es",
      section: null,
    });
  });

  it("goes the other way, from the Spanish page back to the English one", () => {
    expect(switcherDestination(post, "es", ["en", "es"])).toEqual({
      href: "/blog/implementing-value-objects",
      locale: "en",
      section: null,
    });
  });

  it("carries a Part's destination through its Series", () => {
    const part = { kind: "post" as const, slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" };

    expect(switcherDestination(part, "en", ["en", "es"]).href).toBe(
      "/es/series/pragmatic-nodejs-api/project-setup",
    );
  });

  it("carries a Field Note's destination through its Project", () => {
    const note = {
      kind: "post" as const,
      slug: "product-matching",
      seriesSlug: null,
      projectSlug: "chekalo",
    };

    expect(switcherDestination(note, "en", ["en", "es"]).href).toBe(
      "/es/projects/chekalo/product-matching",
    );
  });

  it("carries a Series landing's destination", () => {
    const series = { kind: "series" as const, slug: "pragmatic-nodejs-api" };

    expect(switcherDestination(series, "en", ["en", "es"]).href).toBe(
      "/es/series/pragmatic-nodejs-api",
    );
  });

  it("carries a Project landing's destination", () => {
    const project = { kind: "project" as const, slug: "chekalo" };

    expect(switcherDestination(project, "en", ["en", "es"]).href).toBe("/es/projects/chekalo");
  });
});

describe("switcherDestination — a document without one", () => {
  it("sends a Post to /blog rather than to a 404", () => {
    const post = { kind: "post" as const, slug: "implementing-value-objects", seriesSlug: null };

    expect(switcherDestination(post, "en", ["en"])).toEqual({
      href: "/es/blog",
      locale: "es",
      section: "blog",
    });
  });

  it("sends a Part to /blog too — the same Post-shaped fallback, through its Series address", () => {
    const part = { kind: "post" as const, slug: "project-setup", seriesSlug: "pragmatic-nodejs-api" };

    expect(switcherDestination(part, "en", ["en"]).href).toBe("/es/blog");
  });

  it("sends a Series landing to /series", () => {
    const series = { kind: "series" as const, slug: "pragmatic-nodejs-api" };

    expect(switcherDestination(series, "en", ["en"])).toEqual({
      href: "/es/series",
      locale: "es",
      section: "series",
    });
  });

  it("sends a Project landing to /projects", () => {
    const project = { kind: "project" as const, slug: "chekalo" };

    expect(switcherDestination(project, "en", ["en"])).toEqual({
      href: "/es/projects",
      locale: "es",
      section: "projects",
    });
  });

  it("falls back the other way too, from Spanish to the English section index", () => {
    const post = { kind: "post" as const, slug: "una-nota", seriesSlug: null };

    expect(switcherDestination(post, "es", ["es"])).toEqual({
      href: "/blog",
      locale: "en",
      section: "blog",
    });
  });
});

describe("switcherDestination — an index", () => {
  it("goes to the equivalent index, which always exists", () => {
    expect(switcherDestination({ kind: "index", path: "/blog" }, "en", ["en", "es"])).toEqual({
      href: "/es/blog",
      locale: "es",
      section: null,
    });
  });

  it("sends the home page to /es, not /es/", () => {
    expect(switcherDestination({ kind: "index", path: "/" }, "en", ["en", "es"]).href).toBe("/es");
  });

  it("sends /cv to /es/cv", () => {
    expect(switcherDestination({ kind: "index", path: "/cv" }, "en", ["en", "es"]).href).toBe(
      "/es/cv",
    );
  });

  /** A Tag's own page is modelled as the Tags index — see `switcher.test.ts`. */
  it("sends the Tags index to /es/tags", () => {
    expect(switcherDestination({ kind: "index", path: "/tags" }, "en", ["en", "es"]).href).toBe(
      "/es/tags",
    );
  });
});
