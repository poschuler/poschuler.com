import type { Locale } from "../../app/context.ts";
import { LOCALES } from "../../app/context.ts";
import {
  documentAddresses,
  hreflangEntries,
  type DocumentIdentity,
} from "../../app/lib/seo/alternates.ts";
import { postHref, projectHref, withLocale } from "../../app/lib/hrefs.ts";
import type { ChangeFrequency, SitemapAlternate, SitemapRoute } from "../../app/lib/seo/sitemap.ts";
import { latestRevision, parseRevisions } from "../../app/lib/revisions.ts";

/**
 * The routes the sitemap advertises, derived from what is actually in D1.
 *
 * Split out of `generate-kv-json.ts` mainly so `today` can be passed in. The
 * fallback used to read the clock directly, which made the one branch that
 * matters — an empty store — impossible to test and the output impossible to
 * reproduce.
 *
 * **Locale-aware.** This used to map each row to one URL with no Locale in it
 * at all — so a Post translated into Spanish would have advertised
 * `/blog/<slug>` twice, once per row, both times the same address. It now
 * groups every document by Slug first and emits one `SitemapRoute` per Locale
 * that actually exists for it, each carrying the reciprocal alternates
 * `app/lib/seo/alternates.ts` computes — the same module the page `<head>`
 * reads, so the sitemap and the `hreflang` cannot disagree about which Locales
 * exist for a document.
 */

/** Only the columns the sitemap reads. */
export type SitemapContentItem = {
  slug: string;
  type: string;
  lang: Locale;
  publishedStringDate: string;
  /**
   * The stored revisions, as the JSON string the column holds. Optional
   * because a Bookmark has none and never can — its body lives at the Source.
   */
  updates?: string;
  /**
   * The Container, when the Post has one. It decides the address: a Field Note
   * is served under its Project, and `/blog/<slug>` redirects it rather than
   * serving it.
   */
  projectSlug?: string | null;
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
  lang: Locale;
  updates: string;
};

/**
 * A Tag some Post carries in some Locale — one row per `(Tag, Locale)` pair
 * that reaches a Post, which is what decides whether `/tags` and `/es/tags`
 * each have anything to advertise, independently: a Spanish Tags index counts
 * Spanish Posts only.
 *
 * Only the Tags **Posts** carry, which is what the index lists and therefore
 * what decides whether the index has anything on it. The table holds Bookmark
 * rows too and they back no page.
 *
 * It arrives whole rather than as a count, even though nothing below reads the
 * string. The list is what makes *no URL per Tag* a decision this module can be
 * held to: given the Tags, a test can assert that none of them became a route.
 * A number could only ever assert that a page appeared.
 */
export type SitemapTag = {
  tag: string;
  lang: Locale;
};

/**
 * The two collections that are not Content Items.
 *
 * An object rather than positional parameters, so a call site names which
 * collection it is handing over.
 */
export type SitemapCollections = {
  projects?: SitemapProject[];
  tags?: SitemapTag[];
};

/** One Slug's rows, grouped across the Locales it actually has. */
type SlugGroup<T> = { locales: Locale[]; rows: Map<Locale, T> };

function groupBySlug<T extends { slug: string; lang: Locale }>(rows: T[]): Map<string, SlugGroup<T>> {
  const groups = new Map<string, SlugGroup<T>>();

  for (const row of rows) {
    const group = groups.get(row.slug) ?? { locales: [], rows: new Map<Locale, T>() };

    group.locales.push(row.lang);
    group.rows.set(row.lang, row);
    groups.set(row.slug, group);
  }

  return groups;
}

function firstRow<T>(group: SlugGroup<T>): T {
  return group.rows.get(group.locales[0])!;
}

/** This Locale's rows, in whatever relative order the caller already has them in. */
function inLocale<T extends { lang: Locale }>(rows: T[], locale: Locale): T[] {
  return rows.filter((row) => row.lang === locale);
}

/**
 * A document's relative path in one Locale, via `hrefs.ts` — never
 * reconstructed here. Mirrors the private `relativePath` in
 * `app/lib/seo/alternates.ts`, which is not exported: that module composes an
 * *absolute* address, and `SitemapRoute.url` must stay relative
 * (`generateSitemap` is what joins it to the domain).
 */
function relativePathFor(identity: DocumentIdentity, locale: Locale): string {
  switch (identity.kind) {
    case "post":
      return postHref(identity, locale);
    case "project":
      return projectHref(identity.slug, locale);
    case "index":
      return withLocale(identity.path, locale);
  }
}

/**
 * The reciprocal alternates for a document — `hreflangEntries` in
 * `app/lib/seo/alternates.ts`, the exact set each of those documents also
 * declares in its own `<head>`. Composing it here a second time is what let
 * the sitemap assert pairs no page confirmed, so this reads the one
 * definition rather than rebuilding it from `alternates` and `xDefault`.
 *
 * The set does not depend on which Locale is asking — it is built from
 * `existingLocales` alone — so it is computed once per document and reused for
 * every Locale variant's own `SitemapRoute`, not once per route.
 * `existingLocales[0]` is a placeholder for the one part of the answer that
 * *does* depend on the asking Locale — the canonical — which nothing here
 * reads.
 */
function alternatesFor(
  identity: DocumentIdentity,
  existingLocales: readonly Locale[],
): SitemapAlternate[] {
  return hreflangEntries(documentAddresses(identity, existingLocales[0], existingLocales));
}

/** One `SitemapRoute` per Locale in `existingLocales`, all sharing one alternates set. */
function routesFor(
  identity: DocumentIdentity,
  existingLocales: readonly Locale[],
  lastmodFor: (locale: Locale) => string,
  changefreq: ChangeFrequency,
  priority: number,
): SitemapRoute[] {
  const alternates = alternatesFor(identity, existingLocales);

  return existingLocales.map((locale) => ({
    url: relativePathFor(identity, locale),
    lastmod: lastmodFor(locale),
    changefreq,
    priority,
    alternates,
  }));
}

export function buildSitemapRoutes(
  items: SitemapContentItem[],
  { fallbackLastmod, resumeLastmod }: SitemapDates,
  { projects = [], tags = [] }: SitemapCollections = {},
): SitemapRoute[] {
  const posts = items.filter((item) => item.type === "post");
  const bookmarks = items.filter((item) => item.type === "link");
  // A Field Note is served under its Container; everything else under `/blog`.
  const loosePosts = posts.filter((post) => !post.projectSlug);
  const notes = posts.filter((post) => post.projectSlug);

  const lastModOf = (list: { publishedStringDate: string }[]) =>
    list.length > 0 ? list[0].publishedStringDate : fallbackLastmod;

  /** The newest head-of-list date across several already-sorted lists, or the fallback if all are empty. */
  const newestAmong = (...lists: { publishedStringDate: string }[][]) => {
    const heads = lists.filter((list) => list.length > 0).map((list) => list[0].publishedStringDate);

    return heads.length > 0 ? newest(heads) : fallbackLastmod;
  };

  /**
   * The most recent revision, or the date the document carries when it has
   * none. This is the whole point of recording revisions for a crawler: a Post
   * rewritten for a new major version is not the document it was when it was
   * published, and dating it by its publication says the opposite.
   */
  const revisedAt = (document: { updates?: string }, fallback: string) =>
    latestRevision(parseRevisions(document.updates ?? "[]"))?.date ?? fallback;

  const newest = (dates: string[]) => dates.reduce((a, b) => (a > b ? a : b));

  // --- Loose Posts and Field Notes: grouped by Slug, one entry per Locale that exists for it ---

  const loosePostGroups = groupBySlug(loosePosts);
  const noteGroups = groupBySlug(notes);

  const loosePostRoutes: SitemapRoute[] = [...loosePostGroups.entries()].flatMap(([slug, group]) => {
    const identity: DocumentIdentity = { kind: "post", slug };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => {
      const row = group.rows.get(locale)!;

      return {
        url: postHref({ slug }, locale),
        lastmod: revisedAt(row, row.publishedStringDate),
        changefreq: "monthly",
        priority: 0.7,
        alternates,
      };
    });
  });

  const noteRoutes: SitemapRoute[] = [...noteGroups.entries()].flatMap(([slug, group]) => {
    const projectSlug = firstRow(group).projectSlug!;
    const identity: DocumentIdentity = { kind: "post", slug, projectSlug };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => {
      const row = group.rows.get(locale)!;

      return {
        url: postHref({ slug, projectSlug }, locale),
        lastmod: revisedAt(row, row.publishedStringDate),
        changefreq: "monthly",
        priority: 0.7,
        alternates,
      };
    });
  });

  // --- Projects ---

  const projectGroups = groupBySlug(projects);

  const projectItemRoutes: SitemapRoute[] = [...projectGroups.entries()].flatMap(([slug, group]) => {
    const identity: DocumentIdentity = { kind: "project", slug };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => ({
      url: projectHref(slug, locale),
      lastmod: revisedAt(group.rows.get(locale)!, fallbackLastmod),
      changefreq: "monthly",
      priority: 0.7,
      alternates,
    }));
  });

  // Dated by the most recently revised project in that Locale, not by a clock
  // and not by the index page's own existence.
  const projectIndexLocales = LOCALES.filter((locale) => inLocale(projects, locale).length > 0);
  const projectIndexRoutes: SitemapRoute[] =
    projectIndexLocales.length > 0
      ? routesFor(
          { kind: "index", path: "/projects" },
          projectIndexLocales,
          (locale) =>
            newest(inLocale(projects, locale).map((project) => revisedAt(project, fallbackLastmod))),
          "monthly",
          0.7,
        )
      : [];

  // --- Tags: the index only. No URL per Tag, deliberately (see `SitemapTag`'s
  // own doc) — every individual Tag page declares `noindex, follow`, and a
  // sitemap advertising a page that asks not to be indexed is the site
  // contradicting itself in the two files a crawler reads first. Dated from
  // the newest Post in that Locale, like `/blog`: what changes this page is
  // that a Post arrived carrying Tags, and a Post is the only thing that can
  // change a count on it — Bookmark Tags back no page.
  const tagIndexLocales = LOCALES.filter((locale) => inLocale(tags, locale).length > 0);
  const tagIndexRoutes: SitemapRoute[] =
    tagIndexLocales.length > 0
      ? routesFor(
          { kind: "index", path: "/tags" },
          tagIndexLocales,
          (locale) => lastModOf(inLocale(posts, locale)),
          "monthly",
          0.5,
        )
      : [];

  // --- Blog: the loose Posts, plus each Project with a published Field Note,
  // as a single entry — `/blog`'s own rule. Both are Posts (a loose Post or a
  // Field Note), so a Locale with zero Posts of any kind has neither, and this
  // is one filter rather than two: an index advertising nothing is worse than
  // no index, and that applies here exactly as it already does to `/projects`
  // and `/tags`.
  const blogIndexLocales = LOCALES.filter((locale) => inLocale(posts, locale).length > 0);
  const blogIndexRoutes: SitemapRoute[] =
    blogIndexLocales.length > 0
      ? routesFor(
          { kind: "index", path: "/blog" },
          blogIndexLocales,
          (locale) => lastModOf(inLocale(posts, locale)),
          "monthly",
          0.6,
        )
      : [];

  // --- Home, Bookmarks and Timeline: always both Locales. Every index exists
  // unconditionally, and none of the three route modules ever calls
  // `emptyIndexRobots` — the home page describes a person, not a list;
  // Bookmarks belong to both Locales identically, having no Locale of their
  // own; and the Timeline interleaves this Locale's Posts with every Bookmark,
  // so it is only ever as empty as `/bookmarks` is.
  const homeRoutes = routesFor(
    { kind: "index", path: "/" },
    LOCALES,
    (locale) => lastModOf(inLocale(posts, locale)),
    "monthly",
    1.0,
  );

  const bookmarksRoutes = routesFor(
    { kind: "index", path: "/bookmarks" },
    LOCALES,
    () => lastModOf(bookmarks),
    "monthly",
    0.5,
  );

  const timelineRoutes = routesFor(
    { kind: "index", path: "/timeline" },
    LOCALES,
    (locale) => newestAmong(inLocale(posts, locale), bookmarks),
    "monthly",
    0.5,
  );

  // --- The Resume: both Locales, like Home, Bookmarks and Timeline above —
  // `/cv` is mounted in both branches (ADR 0010) and, since #48, each carries
  // its own text, so there is no empty Locale to exclude.
  // Dated by the same `resumeLastmod` on both sides: one document, one
  // `meta.lastModified`, regardless of which Locale is asking.
  const cvRoutes = routesFor({ kind: "index", path: "/cv" }, LOCALES, () => resumeLastmod, "monthly", 0.8);

  return [
    ...homeRoutes,
    ...cvRoutes,
    ...blogIndexRoutes,
    ...bookmarksRoutes,
    ...timelineRoutes,
    ...projectIndexRoutes,
    ...projectItemRoutes,
    ...noteRoutes,
    ...tagIndexRoutes,
    ...loosePostRoutes,
  ];
}
