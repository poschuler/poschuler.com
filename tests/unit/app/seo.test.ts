import { describe, expect, it } from "vitest";

import { generateRobotsTxt } from "~/lib/seo/robots";
import { generateSitemap } from "~/lib/seo/sitemap";

/**
 * Both renderers are hand-rolled rather than pulled from a dependency, so the
 * escaping and the normalisation are this repo's problem. The sitemap is
 * generated once by the seed pipeline and served verbatim from KV for an hour,
 * which means a malformed document stays malformed for as long as nobody
 * re-seeds.
 */

describe("generateSitemap", () => {
  it("wraps the urls in a two-namespace urlset — sitemaps.org and xhtml", () => {
    const xml = generateSitemap({ domain: "https://poschuler.com", routes: [{ url: "/blog" }] });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    );
    expect(xml).toContain("<loc>https://poschuler.com/blog</loc>");
    expect(xml.endsWith("</urlset>")).toBe(true);
  });

  it("emits one xhtml:link per alternate, inside the url it belongs to", () => {
    const xml = generateSitemap({
      domain: "https://poschuler.com",
      routes: [
        {
          url: "/blog/foo",
          alternates: [
            { hreflang: "en", href: "https://poschuler.com/blog/foo" },
            { hreflang: "es", href: "https://poschuler.com/es/blog/foo" },
            { hreflang: "x-default", href: "https://poschuler.com/blog/foo" },
          ],
        },
      ],
    });

    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://poschuler.com/blog/foo"/>',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="es" href="https://poschuler.com/es/blog/foo"/>',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://poschuler.com/blog/foo"/>',
    );
  });

  it("emits no xhtml:link for a route with no alternates — a Tag page, were it ever advertised", () => {
    const withNone = generateSitemap({ domain: "https://poschuler.com", routes: [{ url: "/blog" }] });
    const withEmpty = generateSitemap({
      domain: "https://poschuler.com",
      routes: [{ url: "/blog", alternates: [] }],
    });

    expect(withNone).not.toContain("xhtml:link");
    expect(withEmpty).not.toContain("xhtml:link");
  });

  it("escapes XML entities in a location", () => {
    const xml = generateSitemap({
      domain: "https://poschuler.com",
      routes: [{ url: "/search?a=1&b=2" }],
    });

    expect(xml).toContain("<loc>https://poschuler.com/search?a=1&amp;b=2</loc>");
    // The raw ampersand would make the document unparseable.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("normalises a domain with a trailing slash", () => {
    const xml = generateSitemap({ domain: "https://poschuler.com/", routes: [{ url: "/blog" }] });

    expect(xml).toContain("<loc>https://poschuler.com/blog</loc>");
  });

  it("normalises a route without a leading slash", () => {
    const xml = generateSitemap({ domain: "https://poschuler.com", routes: [{ url: "blog" }] });

    expect(xml).toContain("<loc>https://poschuler.com/blog</loc>");
  });

  it("emits the optional tags only when they are given", () => {
    const full = generateSitemap({
      domain: "https://poschuler.com",
      routes: [{ url: "/", lastmod: "2026-07-28", changefreq: "daily", priority: 1 }],
    });

    expect(full).toContain("<lastmod>2026-07-28</lastmod>");
    expect(full).toContain("<changefreq>daily</changefreq>");
    expect(full).toContain("<priority>1</priority>");

    const bare = generateSitemap({ domain: "https://poschuler.com", routes: [{ url: "/" }] });

    expect(bare).not.toContain("<lastmod>");
    expect(bare).not.toContain("<changefreq>");
    expect(bare).not.toContain("<priority>");
  });

  it("emits a priority of 0, which is a value and not an absence", () => {
    const xml = generateSitemap({ domain: "https://poschuler.com", routes: [{ url: "/", priority: 0 }] });

    expect(xml).toContain("<priority>0</priority>");
  });

  it("renders an empty urlset for no routes", () => {
    const xml = generateSitemap({ domain: "https://poschuler.com", routes: [] });

    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<url>");
  });
});

describe("generateRobotsTxt", () => {
  it("emits the fields in the order crawlers expect", () => {
    const txt = generateRobotsTxt([
      {
        userAgent: "*",
        crawlDelay: 10,
        allow: ["/"],
        disallow: ["/set-theme"],
        sitemap: ["https://poschuler.com/sitemap.xml"],
      },
    ]);

    expect(txt.split("\n")).toEqual([
      "User-agent: *",
      "Crawl-delay: 10",
      "Allow: /",
      "Disallow: /set-theme",
      "Sitemap: https://poschuler.com/sitemap.xml",
    ]);
  });

  it("skips the fields that are absent", () => {
    expect(generateRobotsTxt([{ userAgent: "*" }])).toBe("User-agent: *");
  });

  it("separates groups with a blank line", () => {
    const txt = generateRobotsTxt([
      { userAgent: "*", allow: ["/"] },
      { userAgent: "GPTBot", disallow: ["/"] },
    ]);

    expect(txt).toBe("User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /");
  });

  it("renders nothing for no groups", () => {
    expect(generateRobotsTxt([])).toBe("");
    expect(generateRobotsTxt()).toBe("");
  });
});
