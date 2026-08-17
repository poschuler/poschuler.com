import type { Locale } from "~/context";
import { STRINGS } from "~/lib/catalog";
import { navHref, withLocale } from "~/lib/hrefs";

/**
 * The Index vocabulary — the fixed upper step of every trail: the home page,
 * or the section a document sits under. Not a Series Section, which has no
 * page of its own and so is never one of these (see `Crumb` below).
 *
 * **The closed set, and where the same set is written again.** Two other
 * places keep their own list of this same vocabulary rather than reading it
 * from here — the navigation's own `NAV_ITEMS` (`app/routes/layouts/header.tsx`)
 * and the sitemap builder's literals (`seed/kv/sitemap-routes.ts`). Neither is
 * changed by this module; whoever edits `INDEX_PATH` should find them too.
 */
export type Index = "home" | "blog" | "projects" | "series" | "tags";

const INDEX_PATH: Record<Index, string> = {
  home: "/",
  blog: "/blog",
  projects: "/projects",
  series: "/series",
  tags: "/tags",
};

/**
 * One step on the path of URLs that leads to a page.
 *
 * **A Series Section is not one of these**, and that is why the visual
 * breadcrumb on a Part and a `BreadcrumbList` do not match. A `BreadcrumbList`
 * describes URLs a visitor can reach; a Section has no page. Naming it here
 * would declare a level of hierarchy that cannot be visited. The visual
 * breadcrumb may show it, because there it is context for a human rather than
 * a claim about the structure of the site.
 */
export type Crumb = {
  name: string;
  /** Path relative to the origin, e.g. `/series`. */
  path: string;
};

/**
 * An Index's name and path, addressed the way a `BreadcrumbList` step needs —
 * a path about to be concatenated onto an origin, through `withLocale`.
 *
 * **Both halves follow the page's Locale**, which is the whole reason this is
 * a function rather than a constant. A Spanish page used to declare a trail
 * made of English names pointing at English URLs — on `/es/series` and
 * `/es/tags` the entire list was the English one, so not a single step was the
 * page emitting it, while the canonical three lines above said `/es/…`. One
 * `<head>` contradicting itself is worse than a missing `BreadcrumbList`.
 *
 * The name is the one the section already renders as its own heading, read
 * from the same catalogue the header reads (`app/lib/catalog.ts`) — through
 * `STRINGS[locale]` rather than `useStrings()`, because `meta()` is not a
 * component and cannot call a hook. So `/blog` is *Articles*, which is what
 * that page has always been titled and what the trail said in neither Locale.
 *
 * The home page's step has no trailing slash in English — `withLocale("/", …)`
 * gives the empty string there — and that is deliberate: it matches, character
 * for character, the canonical the home page declares for itself. A trail that
 * named `https://poschuler.com/` while the page called itself
 * `https://poschuler.com` would be two URLs for one page in one document.
 */
export function indexCrumb(index: Index, locale: Locale): Crumb {
  const strings = STRINGS[locale];

  return {
    name: index === "home" ? strings.home.crumb : strings[index].heading,
    path: withLocale(INDEX_PATH[index], locale),
  };
}

/**
 * The same Index, addressed the way a `<Link to>` needs — the router-safe
 * form, through `navHref`.
 *
 * **This is not `indexCrumb` with the fields renamed.** The two disagree on
 * exactly one Index: the English home page, where `indexCrumb` deliberately
 * returns the empty string so it matches the canonical `alternates.ts`
 * composes as `${SITE}${path}`. Handed to React Router instead, that empty
 * string is not the root at all — an empty relative path resolves to *the
 * current location*. A 404 page's way out, once built on the same empty
 * string, was measured pointing back at the address that had just 404ed. The
 * two functions are named as a pair precisely so that reaching for the wrong
 * one, at either call site, looks wrong.
 */
export function indexHref(index: Index, locale: Locale): string {
  return navHref(INDEX_PATH[index], locale);
}
