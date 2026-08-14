import { describe, expect, it } from "vitest";

import {
  buildSitemapRoutes,
  type SitemapContentItem,
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
) => buildSitemapRoutes(items, { fallbackLastmod, resumeLastmod });

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

  it("ranks the home page above the sections and the sections above the Posts", () => {
    const routes = routesFor(items);
    const priorityOf = (url: string) => routes.find((route) => route.url === url)?.priority;

    expect(priorityOf("/")).toBe(1.0);
    expect(priorityOf("/resume")).toBe(0.8);
    expect(priorityOf("/blog/newest-post")).toBe(0.7);
    expect(priorityOf("/bookmarks")).toBe(0.5);
  });
});
