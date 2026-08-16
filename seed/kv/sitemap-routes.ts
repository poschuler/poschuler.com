import type { Locale } from "../../app/context.ts";
import { LOCALES } from "../../app/context.ts";
import { documentAddresses, type DocumentIdentity } from "../../app/lib/seo/alternates.ts";
import { postHref, projectHref, seriesHref, withLocale } from "../../app/lib/hrefs.ts";
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
 * **Locale-aware since Part 10 of `evolution-plan/15-phase-3-spanish.md`.**
 * This used to map each row to one URL with no Locale in it at all — so a
 * Post translated into Spanish would have advertised `/blog/<slug>` twice,
 * once per row, both times the same address. It now groups every document by
 * Slug first and emits one `SitemapRoute` per Locale that actually exists for
 * it, each carrying the reciprocal alternates `app/lib/seo/alternates.ts`
 * computes — the same module the page `<head>` reads, so the sitemap and the
 * `hreflang` cannot disagree about which Locales exist for a document.
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
   * The Container, when the Post has one. It decides the address: a Part is
   * served under its Series and has never been reachable at `/blog/<slug>`
   * since the route started redirecting.
   */
  seriesSlug?: string | null;
  /**
   * The other Container a Post can have — a Field Note is served under its
   * Project the same way a Part is served under its Series, and for the same
   * reason: `/blog/<slug>` redirects it rather than serving it.
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
 * Only what the sitemap reads from a Series, which is its Slug and its Locale.
 *
 * **No `updates` column, deliberately.** ADR 0005 gives revisions to documents
 * with no other possible date; a Series has one. What changes on a landing is
 * that a Part arrived, and that Part is already dated — so the date is computed
 * from the Parts below, and rises on its own with every publication. A revision
 * entry reading *added part 4* above an index already showing part 4 is
 * duplication that can be forgotten, at which point the landing lies about its
 * own currency.
 */
export type SitemapSeries = {
  slug: string;
  lang: Locale;
};

/**
 * A Tag some Post carries in some Locale — one row per `(Tag, Locale)` pair
 * that reaches a Post, which is what decides whether `/tags` and `/es/tags`
 * each have anything to advertise, independently (Part 11 of
 * `evolution-plan/15-phase-3-spanish.md`: a Spanish Tags index counts Spanish
 * Posts only).
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
 * The three collections that are not Content Items.
 *
 * An object rather than positional parameters: `SitemapProject[]` satisfies
 * `SitemapSeries[]` structurally, so transposing those two would type-check
 * while publishing every Project under `/series/`. Named fields make that
 * mistake unrepresentable.
 */
export type SitemapCollections = {
  projects?: SitemapProject[];
  series?: SitemapSeries[];
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
    case "series":
      return seriesHref(identity.slug, locale);
    case "project":
      return projectHref(identity.slug, locale);
    case "index":
      return withLocale(identity.path, locale);
  }
}

/**
 * The reciprocal alternates for a document, from the same module the page
 * `<head>` calls — `documentAddresses` in `app/lib/seo/alternates.ts` — plus
 * `x-default`, sitemaps.org's own name for the same fact `alternates.ts` calls
 * the English address.
 *
 * `alternates` and `xDefault` do not depend on which Locale is asking — both
 * are built from `existingLocales` alone (see `documentAddresses`'s own
 * implementation) — so this is computed once per document and reused for
 * every Locale variant's own `SitemapRoute`, not once per route.
 * `existingLocales[0]` is a placeholder for the one part of the answer that
 * *does* depend on the asking Locale — the canonical — which nothing here
 * reads.
 */
function alternatesFor(
  identity: DocumentIdentity,
  existingLocales: readonly Locale[],
): SitemapAlternate[] {
  const { alternates, xDefault } = documentAddresses(identity, existingLocales[0], existingLocales);

  return [
    ...alternates.map(({ locale, href }) => ({ hreflang: locale, href })),
    { hreflang: "x-default", href: xDefault },
  ];
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
  { projects = [], series = [], tags = [] }: SitemapCollections = {},
): SitemapRoute[] {
  const posts = items.filter((item) => item.type === "post");
  const bookmarks = items.filter((item) => item.type === "link");
  // A Part or a Field Note is served under its Container; everything else
  // under `/blog`.
  const loosePosts = posts.filter((post) => !post.seriesSlug && !post.projectSlug);
  const parts = posts.filter((post) => post.seriesSlug);
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

  // --- Loose Posts, Parts and Field Notes: grouped by Slug, one entry per Locale that exists for it ---

  const loosePostGroups = groupBySlug(loosePosts);
  const partGroups = groupBySlug(parts);
  const noteGroups = groupBySlug(notes);

  const loosePostRoutes: SitemapRoute[] = [...loosePostGroups.entries()].flatMap(([slug, group]) => {
    const identity: DocumentIdentity = { kind: "post", slug, seriesSlug: null };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => {
      const row = group.rows.get(locale)!;

      return {
        url: postHref({ slug, seriesSlug: null }, locale),
        lastmod: revisedAt(row, row.publishedStringDate),
        changefreq: "monthly",
        priority: 0.7,
        alternates,
      };
    });
  });

  const partRoutes: SitemapRoute[] = [...partGroups.entries()].flatMap(([slug, group]) => {
    const seriesSlug = firstRow(group).seriesSlug!;
    const identity: DocumentIdentity = { kind: "post", slug, seriesSlug };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => {
      const row = group.rows.get(locale)!;

      return {
        url: postHref({ slug, seriesSlug }, locale),
        lastmod: revisedAt(row, row.publishedStringDate),
        changefreq: "monthly",
        priority: 0.7,
        alternates,
      };
    });
  });

  const noteRoutes: SitemapRoute[] = [...noteGroups.entries()].flatMap(([slug, group]) => {
    const projectSlug = firstRow(group).projectSlug!;
    const identity: DocumentIdentity = { kind: "post", slug, seriesSlug: null, projectSlug };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => {
      const row = group.rows.get(locale)!;

      return {
        url: postHref({ slug, seriesSlug: null, projectSlug }, locale),
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

  // --- Series ---

  const seriesGroups = groupBySlug(series);

  const seriesLastmod = (slug: string, locale: Locale): string | null => {
    const dates = [...partGroups.values()]
      .filter((group) => firstRow(group).seriesSlug === slug)
      .map((group) => group.rows.get(locale))
      .filter((row): row is SitemapContentItem => row !== undefined)
      .map((row) => revisedAt(row, row.publishedStringDate));

    // A Series exists the moment it is announced — the arc is the point, not
    // the word count — so a landing with nothing published behind it yet is
    // an ordinary state, and `null` says "the caller's fallback applies"
    // rather than inventing a date nothing on the landing carries.
    return dates.length > 0 ? newest(dates) : null;
  };

  const seriesItemRoutes: SitemapRoute[] = [...seriesGroups.entries()].flatMap(([slug, group]) => {
    const identity: DocumentIdentity = { kind: "series", slug };
    const alternates = alternatesFor(identity, group.locales);

    return group.locales.map((locale): SitemapRoute => ({
      url: seriesHref(slug, locale),
      lastmod: seriesLastmod(slug, locale) ?? fallbackLastmod,
      changefreq: "monthly",
      priority: 0.7,
      alternates,
    }));
  });

  const seriesIndexLocales = LOCALES.filter((locale) => inLocale(series, locale).length > 0);
  const seriesIndexRoutes: SitemapRoute[] =
    seriesIndexLocales.length > 0
      ? routesFor(
          { kind: "index", path: "/series" },
          seriesIndexLocales,
          (locale) =>
            newest(
              [...seriesGroups.entries()]
                .filter(([, group]) => group.locales.includes(locale))
                .map(([slug]) => seriesLastmod(slug, locale) ?? fallbackLastmod),
            ),
          "monthly",
          0.6,
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

  // --- Blog: the loose Posts, plus each Series and each Project with a
  // published Field Note, all as a single entry — `/blog`'s own rule. Every
  // one of the three is a Post (a loose Post, a Part or a Field Note), so a
  // Locale with zero Posts of any kind has none of the three, and this is one
  // filter rather than three (Part 6: "an index advertising nothing is worse
  // than no index" applies here exactly as it already does to `/projects`,
  // `/series` and `/tags`).
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

  // --- Home, Bookmarks and Timeline: always both Locales. Part 6 makes every
  // index exist unconditionally, and none of the three route modules ever
  // calls `emptyIndexRobots` — the home page describes a person, not a list;
  // Bookmarks belong to both Locales identically (Part 7); and the Timeline
  // interleaves this Locale's Posts with every Bookmark, so it is only ever
  // as empty as `/bookmarks` is.
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

  // --- The Resume: `/cv` only, until #48 gives it Spanish text — the same
  // restriction `app/lib/seo/switcher.ts`'s own `resume` case documents.
  const cvRoutes = routesFor({ kind: "index", path: "/cv" }, ["en"], () => resumeLastmod, "monthly", 0.8);

  return [
    ...homeRoutes,
    ...cvRoutes,
    ...blogIndexRoutes,
    ...bookmarksRoutes,
    ...timelineRoutes,
    ...projectIndexRoutes,
    ...projectItemRoutes,
    ...noteRoutes,
    ...seriesIndexRoutes,
    ...seriesItemRoutes,
    ...partRoutes,
    ...tagIndexRoutes,
    ...loosePostRoutes,
  ];
}
