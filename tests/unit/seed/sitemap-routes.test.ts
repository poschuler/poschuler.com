import { describe, expect, it } from "vitest";

import {
  buildSitemapRoutes,
  type SitemapContentItem,
  type SitemapProject,
  type SitemapSeries,
} from "../../../seed/kv/sitemap-routes";

/**
 * The sitemap is generated once and served verbatim from KV for an hour, so a
 * route missing here is a route search engines stop being told about until
 * someone re-seeds.
 */

const item = (
  slug: string,
  type: "post" | "link",
  publishedStringDate: string,
): SitemapContentItem => ({ slug, type, publishedStringDate });

/** Newest first, the order the D1 query returns. */
const items = [
  item("newest-post", "post", "2026-05-01"),
  item("a-bookmark", "link", "2026-03-01"),
  item("older-post", "post", "2026-01-01"),
];

/** Dates a section with nothing in it. Deliberately not the clock — see the caller. */
const FALLBACK = "2026-07-28";

/**
 * The Resume's own `meta.lastModified`, which the caller reads from
 * `resume.json`. It is a parameter rather than a constant in this module so the
 * date lives beside the document it describes.
 */
const RESUME_LASTMOD = "2026-08-14";

const routesFor = (
  items: SitemapContentItem[],
  fallbackLastmod = FALLBACK,
  resumeLastmod = RESUME_LASTMOD,
  projects: SitemapProject[] = [],
  series: SitemapSeries[] = [],
) => buildSitemapRoutes(items, { fallbackLastmod, resumeLastmod }, { projects, series });

/** A Part: a Post whose Container says where it is served from. */
const part = (
  slug: string,
  seriesSlug: string,
  publishedStringDate: string,
): SitemapContentItem => ({ slug, type: "post", publishedStringDate, seriesSlug });

/** `updates` arrives as the stored JSON string, the form the column holds. */
const project = (slug: string, ...dates: string[]): SitemapProject => ({
  slug,
  updates: JSON.stringify(dates.map((date) => ({ date, note: "Revised." }))),
});

const urlsOf = (routes: ReturnType<typeof buildSitemapRoutes>) => routes.map((route) => route.url);

describe("buildSitemapRoutes", () => {
  it("lists the five static routes and one per Post", () => {
    expect(urlsOf(routesFor(items))).toEqual([
      "/",
      "/resume",
      "/blog",
      "/bookmarks",
      "/timeline",
      "/blog/newest-post",
      "/blog/older-post",
    ]);
  });

  it("gives no URL to a Bookmark — its body lives at the Source", () => {
    const urls = urlsOf(routesFor(items));

    expect(urls).not.toContain("/blog/a-bookmark");
    expect(urls.some((url) => url.includes("a-bookmark"))).toBe(false);
  });

  /**
   * Each section's `lastmod` is the head of its list rather than a scan for the
   * maximum, so the caller's ordering is load-bearing.
   */
  it("dates each section from its newest item", () => {
    const routes = routesFor(items);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(lastmodOf("/")).toBe("2026-05-01");
    expect(lastmodOf("/blog")).toBe("2026-05-01");
    expect(lastmodOf("/bookmarks")).toBe("2026-03-01");
    // Everything, so it moves with whichever kind of Content Item is newest.
    expect(lastmodOf("/timeline")).toBe("2026-05-01");
  });

  it("falls back for a section with nothing in it", () => {
    const routes = routesFor([item("only-a-bookmark", "link", "2026-03-01")]);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(lastmodOf("/blog")).toBe(FALLBACK);
    expect(lastmodOf("/bookmarks")).toBe("2026-03-01");
  });

  it("still lists the static routes when the store is empty", () => {
    const routes = routesFor([]);

    expect(urlsOf(routes)).toEqual(["/", "/resume", "/blog", "/bookmarks", "/timeline"]);
    expect(routes.every((route) => route.lastmod === FALLBACK || route.url === "/resume")).toBe(true);
  });

  /** Read from `resume.json`'s own `meta.lastModified`, not from any content. */
  it("dates /resume from the date the Resume itself carries", () => {
    const routes = routesFor(items, FALLBACK, "2026-02-02");

    expect(routes.find((route) => route.url === "/resume")?.lastmod).toBe("2026-02-02");
  });

  it("does not let the Resume's date leak into any other section", () => {
    const routes = routesFor(items, FALLBACK, "2026-02-02");
    const others = routes.filter((route) => route.url !== "/resume");

    expect(others.every((route) => route.lastmod !== "2026-02-02")).toBe(true);
  });

  /**
   * The point of recording revisions for a crawler: a Post rewritten for a new
   * major version is not the document it was when it was published, and dating
   * it by its publication tells Google the opposite.
   */
  it("dates a revised Post by its latest revision, not by its publication", () => {
    const revised: SitemapContentItem = {
      ...item("newest-post", "post", "2026-05-01"),
      updates: JSON.stringify([{ date: "2027-02-10", note: "Updated for Node 24." }]),
    };
    const routes = routesFor([revised]);

    expect(routes.find((route) => route.url === "/blog/newest-post")?.lastmod).toBe("2027-02-10");
  });

  it("dates an unrevised Post by its publication, as before", () => {
    const routes = routesFor(items);

    expect(routes.find((route) => route.url === "/blog/newest-post")?.lastmod).toBe("2026-05-01");
  });

  /**
   * A Project has no Published At — it is revised in place — so the only date
   * it can be listed by is its most recent revision.
   */
  it("lists the index and one URL per Project, dated by its latest revision", () => {
    const routes = routesFor(items, FALLBACK, RESUME_LASTMOD, [
      project("chekalo", "2026-08-20", "2027-01-15"),
      project("poschuler-com", "2026-08-22"),
    ]);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(urlsOf(routes)).toContain("/projects");
    expect(lastmodOf("/projects/chekalo")).toBe("2027-01-15");
    expect(lastmodOf("/projects/poschuler-com")).toBe("2026-08-22");
  });

  it("dates the index by the most recently revised Project", () => {
    const routes = routesFor(items, FALLBACK, RESUME_LASTMOD, [
      project("chekalo", "2026-08-20"),
      project("poschuler-com", "2027-03-01"),
    ]);

    expect(routes.find((route) => route.url === "/projects")?.lastmod).toBe("2027-03-01");
  });

  /**
   * Phase 1a ships the table before the first Project is written, and an index
   * advertising nothing is worse than no index at all.
   */
  it("advertises no project routes at all when there are none", () => {
    expect(urlsOf(routesFor(items))).not.toContain("/projects");
  });

  it("ranks the home page above the sections and the sections above the Posts", () => {
    const routes = routesFor(items);
    const priorityOf = (url: string) => routes.find((route) => route.url === url)?.priority;

    expect(priorityOf("/")).toBe(1.0);
    expect(priorityOf("/resume")).toBe(0.8);
    expect(priorityOf("/blog/newest-post")).toBe(0.7);
    expect(priorityOf("/bookmarks")).toBe(0.5);
  });
});

/**
 * A Part is a Post with a Container, and the Container decides its address.
 * Listing it under `/blog/<slug>` is not merely stale now that the route
 * redirects — it hands a crawler a URL that answers 301, which is the one thing
 * a sitemap must never contain.
 */
describe("a Series in the sitemap", () => {
  const withParts = [
    part("vertical-slices", "pragmatic-nodejs-api", "2026-02-01"),
    item("a-loose-post", "post", "2026-01-15"),
    part("project-setup", "pragmatic-nodejs-api", "2025-12-25"),
  ];

  const series: SitemapSeries[] = [{ slug: "pragmatic-nodejs-api" }];

  it("serves every Part under its Container, never under /blog", () => {
    const urls = urlsOf(routesFor(withParts, FALLBACK, RESUME_LASTMOD, [], series));

    expect(urls).toContain("/series/pragmatic-nodejs-api/project-setup");
    expect(urls).not.toContain("/blog/project-setup");
    expect(urls).toContain("/blog/a-loose-post");
  });

  it("lists the index and one URL per Series", () => {
    const urls = urlsOf(routesFor(withParts, FALLBACK, RESUME_LASTMOD, [], series));

    expect(urls).toContain("/series");
    expect(urls).toContain("/series/pragmatic-nodejs-api");
  });

  /**
   * The landing has no date of its own and gets no `updates` column: what
   * changes on it is that a Part arrived, and that Part is already dated. So
   * its currency is computed, and rises on its own with every Part published.
   */
  it("dates a landing by the newest date among its Parts", () => {
    const routes = routesFor(withParts, FALLBACK, RESUME_LASTMOD, [], series);

    expect(routes.find((route) => route.url === "/series/pragmatic-nodejs-api")?.lastmod).toBe(
      "2026-02-01",
    );
  });

  it("dates a Part by its latest revision, like any other Post", () => {
    const revised: SitemapContentItem = {
      ...part("project-setup", "pragmatic-nodejs-api", "2025-12-25"),
      updates: JSON.stringify([{ date: "2026-06-01", note: "Updated for Node 24." }]),
    };
    const routes = routesFor([revised], FALLBACK, RESUME_LASTMOD, [], series);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(lastmodOf("/series/pragmatic-nodejs-api/project-setup")).toBe("2026-06-01");
    // And the landing follows it: a revised Part is a changed landing.
    expect(lastmodOf("/series/pragmatic-nodejs-api")).toBe("2026-06-01");
  });

  it("dates the index by the newest date across every Series", () => {
    const routes = routesFor(
      [...withParts, part("first-note", "volume-two", "2027-04-01")],
      FALLBACK,
      RESUME_LASTMOD,
      [],
      [...series, { slug: "volume-two" }],
    );

    expect(routes.find((route) => route.url === "/series")?.lastmod).toBe("2027-04-01");
  });

  /**
   * A Series exists the moment it is announced — the arc is the point, not the
   * word count — so its landing is a real page with nothing published behind it
   * yet, and the only date the repository holds for it is the fallback.
   */
  it("still lists a Series that has published nothing", () => {
    const routes = routesFor(
      [item("a-loose-post", "post", "2026-01-15")],
      FALLBACK,
      RESUME_LASTMOD,
      [],
      [{ slug: "announced-only" }],
    );

    expect(urlsOf(routes)).toContain("/series/announced-only");
    expect(routes.find((route) => route.url === "/series/announced-only")?.lastmod).toBe(FALLBACK);
  });

  it("advertises no series routes at all when there are none", () => {
    const urls = urlsOf(routesFor(items));

    expect(urls).not.toContain("/series");
    expect(urls.some((url) => url.startsWith("/series/"))).toBe(false);
  });
});
