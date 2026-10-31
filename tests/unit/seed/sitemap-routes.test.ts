import { describe, expect, it } from "vitest";

import {
  buildSitemapRoutes,
  type SitemapContentItem,
  type SitemapProject,
  type SitemapTag,
} from "../../../seed/kv/sitemap-routes";

/**
 * The sitemap is generated once and served verbatim from KV for an hour, so a
 * route missing here is a route search engines stop being told about until
 * someone re-seeds.
 *
 * Locale-aware: every fixture below carries `lang`, defaulted to `"en"` so the
 * single-Locale expectations read the same as before — one Locale, nothing
 * translated. `describe("a bilingual document …")` is what exercises the second
 * one.
 */

const item = (
  slug: string,
  type: "post" | "link",
  publishedStringDate: string,
  lang: "en" | "es" = "en",
): SitemapContentItem => ({ slug, type, publishedStringDate, lang });

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
  tags: SitemapTag[] = [],
) => buildSitemapRoutes(items, { fallbackLastmod, resumeLastmod }, { projects, tags });

/** A Field Note: a Post whose Container is a Project. */
const note = (
  slug: string,
  projectSlug: string,
  publishedStringDate: string,
  lang: "en" | "es" = "en",
): SitemapContentItem => ({ slug, type: "post", publishedStringDate, projectSlug, lang });

/** `updates` arrives as the stored JSON string, the form the column holds. */
const project = (slug: string, ...dates: string[]): SitemapProject => ({
  slug,
  lang: "en",
  updates: JSON.stringify(dates.map((date) => ({ date, note: "Revised." }))),
});

const urlsOf = (routes: ReturnType<typeof buildSitemapRoutes>) => routes.map((route) => route.url);

/**
 * `hrefs.ts`'s own root convention (`withLocale`'s docblock): the English
 * root is `""`, not `"/"` — `${SITE}${path}` has to land on `${SITE}` exactly,
 * with nothing appended. `generateSitemap`'s `renderUrl` still turns it into
 * `/` in the rendered XML; this is what `SitemapRoute.url` itself holds.
 */
const HOME_EN = "";

/** The reciprocal alternates a route carries, as `hreflang` alone — `href` is asserted separately where it matters. */
const hreflangsOf = (route: ReturnType<typeof buildSitemapRoutes>[number]) =>
  (route.alternates ?? []).map((alternate) => alternate.hreflang).sort();

describe("buildSitemapRoutes", () => {
  it("lists the nine static routes — Home, cv, Bookmarks and Timeline doubled for /es — and one per Post", () => {
    expect(urlsOf(routesFor(items))).toEqual([
      HOME_EN,
      "/es",
      "/cv",
      "/es/cv",
      "/blog",
      "/bookmarks",
      "/es/bookmarks",
      "/timeline",
      "/es/timeline",
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

    expect(lastmodOf(HOME_EN)).toBe("2026-05-01");
    expect(lastmodOf("/blog")).toBe("2026-05-01");
    expect(lastmodOf("/bookmarks")).toBe("2026-03-01");
    // Everything, so it moves with whichever kind of Content Item is newest.
    expect(lastmodOf("/timeline")).toBe("2026-05-01");
  });

  it("falls back for a section with nothing in it", () => {
    const routes = routesFor([item("only-a-bookmark", "link", "2026-03-01")]);
    const lastmodOf = (url: string) => routes.find((route) => route.url === url)?.lastmod;

    expect(lastmodOf("/bookmarks")).toBe("2026-03-01");
    // No Post at all in this Locale, so `/blog` itself is not advertised —
    // see "an empty index is still not advertised" below.
    expect(urlsOf(routes)).not.toContain("/blog");
  });

  it("still lists the Locale-invariant routes when the store is empty", () => {
    const routes = routesFor([]);

    expect(urlsOf(routes)).toEqual([
      HOME_EN,
      "/es",
      "/cv",
      "/es/cv",
      "/bookmarks",
      "/es/bookmarks",
      "/timeline",
      "/es/timeline",
    ]);
    const cvUrls = ["/cv", "/es/cv"];
    expect(routes.every((route) => route.lastmod === FALLBACK || cvUrls.includes(route.url))).toBe(true);
  });

  /** Read from `resume.json`'s own `meta.lastModified`, not from any content. */
  it("dates /cv from the date the Resume itself carries, in both Locales", () => {
    const routes = routesFor(items, FALLBACK, "2026-02-02");

    expect(routes.find((route) => route.url === "/cv")?.lastmod).toBe("2026-02-02");
    expect(routes.find((route) => route.url === "/es/cv")?.lastmod).toBe("2026-02-02");
  });

  it("does not let the Resume's date leak into any other section", () => {
    const routes = routesFor(items, FALLBACK, "2026-02-02");
    const others = routes.filter((route) => route.url !== "/cv" && route.url !== "/es/cv");

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
   * The table ships before the first Project is written, and an index
   * advertising nothing is worse than no index at all.
   */
  it("advertises no project routes at all when there are none", () => {
    expect(urlsOf(routesFor(items))).not.toContain("/projects");
  });

  it("ranks the home page above the sections and the sections above the Posts", () => {
    const routes = routesFor(items);
    const priorityOf = (url: string) => routes.find((route) => route.url === url)?.priority;

    expect(priorityOf(HOME_EN)).toBe(1.0);
    expect(priorityOf("/cv")).toBe(0.8);
    expect(priorityOf("/blog/newest-post")).toBe(0.7);
    expect(priorityOf("/bookmarks")).toBe(0.5);
  });
});

/** The Series and its Parts are retired: no address under `/series` is advertised. */
describe("no Series in the sitemap", () => {
  it("advertises no series routes at all", () => {
    const urls = urlsOf(routesFor(items));

    expect(urls).not.toContain("/series");
    expect(urls.some((url) => url.startsWith("/series/"))).toBe(false);
  });
});

/**
 * A Field Note is a Post whose Container is a Project, served under it.
 * A Draft never reaches this
 * seam at all — it produces no `content` row, so there is nothing here to
 * filter; what these assert is that a published note gets a URL, and that
 * nothing here invents one for a Slug that was never passed in.
 */
describe("a Field Note in the sitemap", () => {
  const withNotes = [
    note("product-matching", "chekalo", "2026-08-15"),
    item("a-loose-post", "post", "2026-01-15"),
  ];

  const projects: SitemapProject[] = [project("chekalo", "2025-01-01")];

  it("serves a published note under its Project, never under /blog", () => {
    const urls = urlsOf(routesFor(withNotes, FALLBACK, RESUME_LASTMOD, projects));

    expect(urls).toContain("/projects/chekalo/product-matching");
    expect(urls).not.toContain("/blog/product-matching");
    expect(urls).toContain("/blog/a-loose-post");
  });

  /**
   * A Draft produces no `content` row, so it is never in `items` to begin
   * with — the same reason it 404s at its own route. This is that absence,
   * asserted the only way it can be from this seam: nothing but the one
   * published note's own Slug appears under `/projects/chekalo/`.
   */
  it("advertises no address for a Draft, because a Draft is never in the list to begin with", () => {
    const urls = urlsOf(routesFor(withNotes, FALLBACK, RESUME_LASTMOD, projects));
    const chekaloUrls = urls.filter((url) => url.startsWith("/projects/chekalo/"));

    expect(chekaloUrls).toEqual(["/projects/chekalo/product-matching"]);
  });

  it("dates a note by its latest revision, like any other Post", () => {
    const revised: SitemapContentItem = {
      ...note("product-matching", "chekalo", "2026-08-15"),
      updates: JSON.stringify([{ date: "2026-09-01", note: "Clarified the diagram." }]),
    };
    const routes = routesFor([revised], FALLBACK, RESUME_LASTMOD, projects);

    expect(routes.find((route) => route.url === "/projects/chekalo/product-matching")?.lastmod).toBe(
      "2026-09-01",
    );
  });

  /**
   * A Project's own `lastmod` does not follow its
   * notes — `SitemapProject`'s own doc explains why: a Project is revised in
   * place, and its own revisions are the only date it has.
   */
  it("does not let a note's date move its Project's own landing", () => {
    const routes = routesFor(withNotes, FALLBACK, RESUME_LASTMOD, projects);

    expect(routes.find((route) => route.url === "/projects/chekalo")?.lastmod).toBe("2025-01-01");
  });
});

/**
 * The `/tags` namespace is the one place where the sitemap and the routes
 * disagree on purpose: the index is advertised, and the ten pages it links to
 * are not. Each of those declares `noindex, follow`, and a sitemap must never
 * advertise a page that asks not to be indexed — the two would be a site
 * contradicting itself in the two files a crawler reads first.
 *
 * The Tags are passed in whole rather than as a count, so this can assert what
 * did *not* happen to them.
 */
describe("the Tag index in the sitemap", () => {
  const tags: SitemapTag[] = [
    { tag: "nodejs", lang: "en" },
    { tag: "typescript", lang: "en" },
  ];

  const withTags = (items: SitemapContentItem[], carried: SitemapTag[] = tags) =>
    routesFor(items, FALLBACK, RESUME_LASTMOD, [], carried);

  it("advertises the index", () => {
    expect(urlsOf(withTags(items))).toContain("/tags");
  });

  it("advertises no individual Tag page, however many Tags there are", () => {
    const urls = urlsOf(withTags(items));

    expect(urls).not.toContain("/tags/nodejs");
    expect(urls.some((url) => url.startsWith("/tags/"))).toBe(false);
  });

  /**
   * Dated like `/blog`, from the newest Post — what changes this page is that a
   * Post arrived carrying Tags, and a Post is the only thing that can change a
   * count on it. A Bookmark cannot: its Tags back no page here.
   */
  it("dates the index from the newest Post", () => {
    const routes = withTags(items);

    expect(routes.find((route) => route.url === "/tags")?.lastmod).toBe("2026-05-01");
  });

  /**
   * The same rule `/projects` follows. Ten of the twenty-two
   * declared Tags reach a Post today, but a repository whose Posts carry none
   * would be advertising an index of nothing.
   */
  it("advertises no index at all when no Post carries a Tag", () => {
    expect(urlsOf(withTags(items, []))).not.toContain("/tags");
  });
});

/**
 * Every `SitemapRoute` this module builds carries its own reciprocal
 * alternates — `hreflang` entries built from `app/lib/seo/alternates.ts`, the
 * same module the page `<head>` calls, plus `x-default`. Tag pages are the
 * one exception, and they are already excluded from the sitemap entirely.
 */
describe("alternates", () => {
  it("gives a Locale-only document alternates for that Locale alone, plus x-default", () => {
    const routes = routesFor(items);
    const post = routes.find((route) => route.url === "/blog/newest-post")!;

    expect(hreflangsOf(post)).toEqual(["en", "x-default"]);
    expect(post.alternates).toContainEqual({
      hreflang: "en",
      href: "https://poschuler.com/blog/newest-post",
    });
    expect(post.alternates).toContainEqual({
      hreflang: "x-default",
      href: "https://poschuler.com/blog/newest-post",
    });
  });

  it("gives every index the same reciprocal alternates the page head would compute", () => {
    const routes = routesFor(items);
    const home = routes.find((route) => route.url === HOME_EN)!;

    expect(hreflangsOf(home)).toEqual(["en", "es", "x-default"]);
    expect(home.alternates).toContainEqual({ hreflang: "es", href: "https://poschuler.com/es" });
  });

  it("gives the Resume reciprocal alternates, now that #48 gives it Spanish text", () => {
    const routes = routesFor(items);
    const cv = routes.find((route) => route.url === "/cv")!;
    const cvEs = routes.find((route) => route.url === "/es/cv")!;

    expect(hreflangsOf(cv)).toEqual(["en", "es", "x-default"]);
    expect(cv.alternates).toContainEqual({ hreflang: "es", href: "https://poschuler.com/es/cv" });
    expect(hreflangsOf(cvEs)).toEqual(["en", "es", "x-default"]);
    expect(cv.alternates).toEqual(cvEs.alternates);
  });
});

/**
 * A document translated into Spanish is the case this grouping exists for: the
 * *same* Slug, one row per Locale — never a second URL for what used to be one
 * duplicated address.
 */
describe("a bilingual document", () => {
  it("advertises the English and the Spanish address separately, never the same one twice", () => {
    const bilingual = [
      item("newest-post", "post", "2026-05-01", "en"),
      item("newest-post", "post", "2026-04-20", "es"),
    ];
    const urls = urlsOf(routesFor(bilingual));

    expect(urls).toContain("/blog/newest-post");
    expect(urls).toContain("/es/blog/newest-post");
    // No duplicate: an old defect was two rows, one identical `<loc>`.
    expect(urls.filter((url) => url === "/blog/newest-post")).toHaveLength(1);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("gives each Locale's route the other Locale as a reciprocal alternate", () => {
    const bilingual = [
      item("newest-post", "post", "2026-05-01", "en"),
      item("newest-post", "post", "2026-04-20", "es"),
    ];
    const routes = routesFor(bilingual);
    const en = routes.find((route) => route.url === "/blog/newest-post")!;
    const es = routes.find((route) => route.url === "/es/blog/newest-post")!;

    expect(hreflangsOf(en)).toEqual(["en", "es", "x-default"]);
    expect(hreflangsOf(es)).toEqual(["en", "es", "x-default"]);
    expect(en.alternates).toEqual(es.alternates);
  });

  it("dates each Locale's route from its own row, not the other Locale's", () => {
    const bilingual = [
      item("newest-post", "post", "2026-05-01", "en"),
      item("newest-post", "post", "2026-04-20", "es"),
    ];
    const routes = routesFor(bilingual);

    expect(routes.find((route) => route.url === "/blog/newest-post")?.lastmod).toBe("2026-05-01");
    expect(routes.find((route) => route.url === "/es/blog/newest-post")?.lastmod).toBe("2026-04-20");
  });

  it("advertises a Spanish index once a Locale has content, and not before", () => {
    const onlyEnglish = routesFor(items);

    expect(urlsOf(onlyEnglish)).not.toContain("/es/blog");

    const withSpanish = routesFor([...items, item("primer-articulo", "post", "2026-06-01", "es")]);

    expect(urlsOf(withSpanish)).toContain("/es/blog");
    expect(urlsOf(withSpanish)).toContain("/blog");
  });

  it("keeps a Spanish-only Project's index entry and the English default apart", () => {
    const routes = routesFor(items, FALLBACK, RESUME_LASTMOD, [
      { slug: "chekalo", lang: "es", updates: JSON.stringify([{ date: "2026-08-20", note: "Revised." }]) },
    ]);
    const urls = urlsOf(routes);

    expect(urls).toContain("/es/projects/chekalo");
    expect(urls).not.toContain("/projects/chekalo");
    expect(urls).toContain("/es/projects");
    expect(urls).not.toContain("/projects");

    const esProject = routes.find((route) => route.url === "/es/projects/chekalo")!;

    expect(hreflangsOf(esProject)).toEqual(["es", "x-default"]);
  });
});
