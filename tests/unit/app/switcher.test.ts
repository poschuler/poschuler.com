import { describe, expect, it } from "vitest";

import { switcherDestinationForRoute } from "~/lib/seo/switcher";

/**
 * `switcherDestinationForRoute` is the route-id half of Part 9
 * (`evolution-plan/15-phase-3-spanish.md`) — the pure identity-to-destination
 * rule itself is `switcherDestination`, pinned in `alternates.test.ts`. What
 * matters here is that every route id `app/routes.ts` mounts resolves to the
 * right `DocumentIdentity`, reading the same `existingLocales` field each
 * route's own `meta()` already reads off its loader data — never a second
 * computation.
 */

describe("switcherDestinationForRoute — the index pages", () => {
  it.each([
    ["home", "/"],
    ["bookmarks", "/bookmarks"],
    ["timeline", "/timeline"],
    ["blog", "/blog"],
    ["projects", "/projects"],
    ["series", "/series"],
    ["tags", "/tags"],
  ])("resolves %s to its Spanish equivalent", (routeId, path) => {
    expect(switcherDestinationForRoute(routeId, undefined, "en")).toEqual({
      href: `/es${path === "/" ? "" : path}`,
      locale: "es",
      section: null,
    });
  });

  it("strips the -es suffix, so the Spanish branch's own id resolves the same way", () => {
    expect(switcherDestinationForRoute("blog-es", undefined, "es")).toEqual({
      href: "/blog",
      locale: "en",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — a Tag page", () => {
  it("goes to the Tags index, never the literal /es/tags/:tag", () => {
    expect(switcherDestinationForRoute("tag", { tag: "software-architecture" }, "en")).toEqual({
      href: "/es/tags",
      locale: "es",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — the 404", () => {
  it("goes to the home page in the other Locale", () => {
    expect(switcherDestinationForRoute("catchall", null, "en")).toEqual({
      href: "/es",
      locale: "es",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — the Resume", () => {
  it("goes to /es/cv even with no loader data", () => {
    // `/cv` is mounted in both branches today (ADR 0010) and always
    // resolves — unlike a Post, Series or Project, it is not a document that
    // can 404 for lacking a Translation, so the switcher does not need
    // `existingLocales` to say so before offering it.
    expect(switcherDestinationForRoute("resume", undefined, "en")).toEqual({
      href: "/es/cv",
      locale: "es",
      section: null,
    });
  });

  it("goes the other way too, from the Spanish page back to /cv", () => {
    expect(switcherDestinationForRoute("resume", undefined, "es")).toEqual({
      href: "/cv",
      locale: "en",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — a Post", () => {
  it("reads slug and existingLocales off the loader data, the same fields meta() reads", () => {
    const data = { slug: "implementing-value-objects", existingLocales: ["en", "es"] };

    expect(switcherDestinationForRoute("blog-slug", data, "en")).toEqual({
      href: "/es/blog/implementing-value-objects",
      locale: "es",
      section: null,
    });
  });

  it("falls back to /blog when the loader reports no Translation", () => {
    const data = { slug: "implementing-value-objects", existingLocales: ["en"] };

    expect(switcherDestinationForRoute("blog-slug", data, "en")).toEqual({
      href: "/es/blog",
      locale: "es",
      section: "blog",
    });
  });
});

describe("switcherDestinationForRoute — a Field Note", () => {
  it("carries the destination through its Project, via projectSlug on the loader data", () => {
    const data = {
      slug: "product-matching",
      projectSlug: "chekalo",
      existingLocales: ["en", "es"],
    };

    expect(switcherDestinationForRoute("project-note", data, "en")).toEqual({
      href: "/es/projects/chekalo/product-matching",
      locale: "es",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — a Part", () => {
  it("carries the destination through its Series, via seriesSlug on the loader data", () => {
    const data = {
      slug: "project-setup",
      seriesSlug: "pragmatic-nodejs-api",
      existingLocales: ["en", "es"],
    };

    expect(switcherDestinationForRoute("series-part", data, "en")).toEqual({
      href: "/es/series/pragmatic-nodejs-api/project-setup",
      locale: "es",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — a Project landing", () => {
  it("reads slug and existingLocales off the loader data", () => {
    const data = { slug: "chekalo", existingLocales: ["en"] };

    expect(switcherDestinationForRoute("project-slug", data, "en")).toEqual({
      href: "/es/projects",
      locale: "es",
      section: "projects",
    });
  });
});

describe("switcherDestinationForRoute — a Series landing", () => {
  it("reads slug and existingLocales off the loader data", () => {
    const data = { slug: "pragmatic-nodejs-api", existingLocales: ["en", "es"] };

    expect(switcherDestinationForRoute("series-slug", data, "en")).toEqual({
      href: "/es/series/pragmatic-nodejs-api",
      locale: "es",
      section: null,
    });
  });
});

describe("switcherDestinationForRoute — a document route with no loader data", () => {
  // None of the five document routes carries its own `ErrorBoundary` today, so
  // a 404 renders outside the shared layout and this never happens in a real
  // render — pinned anyway, so a boundary added to one of them later degrades
  // to "render nothing" instead of throwing on a destructure.
  it("returns null rather than throwing when a Post's loader has not run", () => {
    expect(switcherDestinationForRoute("blog-slug", undefined, "en")).toBeNull();
  });
});

describe("switcherDestinationForRoute — an unrecognised route", () => {
  it("returns null rather than guessing an address", () => {
    expect(switcherDestinationForRoute("set-theme", undefined, "en")).toBeNull();
  });
});
