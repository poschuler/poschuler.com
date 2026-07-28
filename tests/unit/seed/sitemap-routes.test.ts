import { describe, expect, it } from "vitest";

import {
  buildSitemapRoutes,
  RESUME_LASTMOD,
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

const TODAY = "2026-07-28";

const urlsOf = (routes: ReturnType<typeof buildSitemapRoutes>) => routes.map((route) => route.url);

describe("buildSitemapRoutes", () => {
  it("lists the four static routes and one per Post", () => {
    expect(urlsOf(buildSitemapRoutes(items, TODAY))).toEqual([
      "/",
      "/resume",
      "/blog",
      "/bookmarks",
      "/blog/newest-post",
      "/blog/older-post",
    ]);
  });

  it("gives no URL to a Bookmark — its body lives at the Source", () => {
    const urls = urlsOf(buildSitemapRoutes(items, TODAY));

    expect(urls).not.toContain("/blog/a-bookmark");
    expect(urls.some((url) => url.includes("a-bookmark"))).toBe(false);
  });

  /**
   * Each section's `lastmod` is the head of its list rather than a scan for the
   * maximum, so the caller's ordering is load-bearing.
   */
  it("dates each section from its newest item", () => {
    const routes = buildSitemapRoutes(items, TODAY);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(lastmodOf("/")).toBe("2026-05-01");
    expect(lastmodOf("/blog")).toBe("2026-05-01");
    expect(lastmodOf("/bookmarks")).toBe("2026-03-01");
  });

  it("falls back to today for a section with nothing in it", () => {
    const routes = buildSitemapRoutes([item("only-a-bookmark", "link", "2026-03-01")], TODAY);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(lastmodOf("/blog")).toBe(TODAY);
    expect(lastmodOf("/bookmarks")).toBe("2026-03-01");
  });

  it("still lists the static routes when the store is empty", () => {
    const routes = buildSitemapRoutes([], TODAY);

    expect(urlsOf(routes)).toEqual(["/", "/resume", "/blog", "/bookmarks"]);
    expect(routes.every((route) => route.lastmod === TODAY || route.url === "/resume")).toBe(true);
  });

  /**
   * Known defect, pinned rather than hidden: the Resume is revised in place and
   * has no Published At, so its `lastmod` is a constant that goes stale the
   * moment `resume.json` changes.
   */
  it("dates /resume from a hardcoded constant, not from any content", () => {
    const routes = buildSitemapRoutes(items, TODAY);

    expect(routes.find((route) => route.url === "/resume")?.lastmod).toBe(RESUME_LASTMOD);
    expect(RESUME_LASTMOD).toBe("2025-12-21");
  });

  it("ranks the home page above the sections and the sections above the Posts", () => {
    const routes = buildSitemapRoutes(items, TODAY);
    const priorityOf = (url: string) => routes.find((route) => route.url === url)?.priority;

    expect(priorityOf("/")).toBe(1.0);
    expect(priorityOf("/resume")).toBe(0.8);
    expect(priorityOf("/blog/newest-post")).toBe(0.7);
    expect(priorityOf("/bookmarks")).toBe(0.5);
  });
});
