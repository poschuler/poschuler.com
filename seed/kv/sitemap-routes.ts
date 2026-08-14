import type { SitemapRoute } from "../../app/lib/seo/sitemap.ts";

/**
 * The routes the sitemap advertises, derived from what is actually in D1.
 *
 * Split out of `generate-kv-json.ts` mainly so `today` can be passed in. The
 * fallback used to read the clock directly, which made the one branch that
 * matters — an empty store — impossible to test and the output impossible to
 * reproduce.
 */

/** Only the columns the sitemap reads. */
export type SitemapContentItem = {
  slug: string;
  type: string;
  publishedStringDate: string;
};

/**
 * Hardcoded: the Resume is revised in place and has no Published At to derive
 * this from. It is stale the moment `resume.json` changes and nothing notices —
 * a known defect, pinned here rather than buried in a template literal.
 */
export const RESUME_LASTMOD = "2025-12-21";

/**
 * `items` must arrive newest first: each section's `lastmod` is taken from the
 * head of its list rather than by scanning for a maximum. That is how the D1
 * query orders them (`order by published_at desc`), and this depends on it.
 *
 * `fallbackLastmod` dates a section with nothing in it. It must not be the
 * clock: the same content would then produce a different sitemap tomorrow,
 * which is the whole reason this parameter exists rather than being read
 * inside — and it is now checked, because CI compares the regenerated payloads
 * against the committed ones byte for byte.
 */
export function buildSitemapRoutes(
  items: SitemapContentItem[],
  fallbackLastmod: string,
): SitemapRoute[] {
  const posts = items.filter((item) => item.type === "post");
  const bookmarks = items.filter((item) => item.type === "link");

  const lastModOf = (list: SitemapContentItem[]) =>
    list.length > 0 ? list[0].publishedStringDate : fallbackLastmod;

  return [
    { url: "/", lastmod: lastModOf(items), changefreq: "monthly", priority: 1.0 },
    { url: "/resume", lastmod: RESUME_LASTMOD, changefreq: "monthly", priority: 0.8 },
    { url: "/blog", lastmod: lastModOf(posts), changefreq: "monthly", priority: 0.6 },
    { url: "/bookmarks", lastmod: lastModOf(bookmarks), changefreq: "monthly", priority: 0.5 },
    // Dated from everything, because it is everything: the Timeline is the one
    // section a new Post *or* a new Bookmark changes.
    { url: "/timeline", lastmod: lastModOf(items), changefreq: "monthly", priority: 0.5 },
    ...posts.map((post) => ({
      url: `/blog/${post.slug}`,
      lastmod: post.publishedStringDate,
      changefreq: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
