import type { SitemapRoute } from "../../app/lib/seo/sitemap.ts";
import { latestRevision, parseRevisions } from "../../app/lib/revisions.ts";

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
  /**
   * The stored revisions, as the JSON string the column holds. Optional
   * because a Bookmark has none and never can — its body lives at the Source.
   */
  updates?: string;
};

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
 *
 * `resumeLastmod` is the Resume's own `meta.lastModified`. The Resume is
 * revised in place and has no Published At, so there is nothing to derive it
 * from; it arrives as a parameter so the date can live inside `resume.json`,
 * three lines from the content it describes, rather than as a constant in this
 * module — which whoever edits the Resume has no reason to open.
 *
 * Deriving it from git instead does not work: CI checks out with
 * `fetch-depth: 1`, so the only commit present is the checkout's own and the
 * date would describe the build rather than the document.
 *
 * The two dates arrive in an object rather than as adjacent positional
 * parameters. Both are `YYYY-MM-DD` strings, so transposing them would
 * type-check silently and publish a sitemap that dates every section wrongly —
 * the one mistake this signature can make, designed out rather than tested for.
 */
export type SitemapDates = {
  fallbackLastmod: string;
  resumeLastmod: string;
};

/**
 * Only the columns the sitemap reads from a Project.
 *
 * A Project has no Published At — it is revised in place, never published — so
 * its most recent revision is the only date it has. `updates` arrives as the
 * stored JSON string, the same form the column holds.
 */
export type SitemapProject = {
  slug: string;
  updates: string;
};

export function buildSitemapRoutes(
  items: SitemapContentItem[],
  { fallbackLastmod, resumeLastmod }: SitemapDates,
  projects: SitemapProject[] = [],
): SitemapRoute[] {
  const posts = items.filter((item) => item.type === "post");
  const bookmarks = items.filter((item) => item.type === "link");

  const lastModOf = (list: SitemapContentItem[]) =>
    list.length > 0 ? list[0].publishedStringDate : fallbackLastmod;

  /**
   * The most recent revision, or the date the document carries when it has
   * none. This is the whole point of recording revisions for a crawler: a Post
   * rewritten for a new major version is not the document it was when it was
   * published, and dating it by its publication says the opposite.
   */
  const revisedAt = (document: { updates?: string }, fallback: string) =>
    latestRevision(parseRevisions(document.updates ?? "[]"))?.date ?? fallback;

  const newest = (dates: string[]) => dates.reduce((a, b) => (a > b ? a : b));

  // Dated by the most recently revised project, not by a clock and not by the
  // index page's own existence.
  const projectsLastmod =
    projects.length > 0
      ? newest(projects.map((project) => revisedAt(project, fallbackLastmod)))
      : fallbackLastmod;

  const projectRoutes: SitemapRoute[] =
    projects.length > 0
      ? [
          { url: "/projects", lastmod: projectsLastmod, changefreq: "monthly", priority: 0.7 },
          ...projects.map((project) => ({
            url: `/projects/${project.slug}`,
            lastmod: revisedAt(project, fallbackLastmod),
            changefreq: "monthly" as const,
            priority: 0.7,
          })),
        ]
      : [];

  return [
    { url: "/", lastmod: lastModOf(items), changefreq: "monthly", priority: 1.0 },
    { url: "/resume", lastmod: resumeLastmod, changefreq: "monthly", priority: 0.8 },
    { url: "/blog", lastmod: lastModOf(posts), changefreq: "monthly", priority: 0.6 },
    { url: "/bookmarks", lastmod: lastModOf(bookmarks), changefreq: "monthly", priority: 0.5 },
    // Dated from everything, because it is everything: the Timeline is the one
    // section a new Post *or* a new Bookmark changes.
    { url: "/timeline", lastmod: lastModOf(items), changefreq: "monthly", priority: 0.5 },
    ...projectRoutes,
    ...posts.map((post) => ({
      url: `/blog/${post.slug}`,
      lastmod: revisedAt(post, post.publishedStringDate),
      changefreq: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
