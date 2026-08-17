import type { Locale } from "~/context";
import { STRINGS } from "~/lib/catalog";
import { postHref, projectHref, seriesHref, withLocale } from "~/lib/hrefs";
import { AUTHOR, SITE } from "./person";

/**
 * The JSON-LD objects the site emits, all of them **derived** from what is
 * already in D1 or KV.
 *
 * No hand-written block per page: structured data that is typed out beside the
 * content it describes agrees with it exactly once, on the day it is written.
 * These builders take the same values the page renders, so the two cannot say
 * different things.
 *
 * **This module builds no URL of its own** (Part 10 of
 * `evolution-plan/15-phase-3-spanish.md`). An article's own address arrives
 * already made — the same `canonical` the page's `<head>` carries, out of
 * `app/lib/seo/alternates.ts` — and every other address here, a Container's or
 * a sibling Part's, comes from `~/lib/hrefs`, the one place a relative path is
 * built. What this file still owns is prepending `SITE`, exactly as
 * `alternates.ts` does — never the segment structure underneath it.
 */

/** A `<script type="application/ld+json">` payload, whatever shape it takes. */
export type JsonLd = Record<string, unknown>;

/**
 * One step on the path of URLs that leads to a page.
 *
 * **A Series Section is not one of these**, and that is why the visual
 * breadcrumb on a Part and this list do not match. A `BreadcrumbList` describes
 * URLs a visitor can reach; a Section has no page. Naming it here would declare
 * a level of hierarchy that cannot be visited. The visual breadcrumb may show
 * it, because there it is context for a human rather than a claim about the
 * structure of the site.
 */
export type Crumb = {
  name: string;
  /** Path relative to the origin, e.g. `/series`. */
  path: string;
};

export function breadcrumbList(crumbs: Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE}${crumb.path}`,
    })),
  };
}

/** A section of this site a trail can pass through — each one an index with an address. */
export type SiteSection = "home" | "blog" | "projects" | "series" | "tags";

const SECTION_PATH: Record<SiteSection, string> = {
  home: "/",
  blog: "/blog",
  projects: "/projects",
  series: "/series",
  tags: "/tags",
};

/**
 * A fixed step on a trail — the home page, or the index a document sits under.
 * The steps below it are the document's own and each route builds those itself.
 *
 * **Both halves follow the page's Locale**, which is the whole reason this is a
 * function rather than the constant it replaced. A Spanish page used to declare
 * a trail made of English names pointing at English URLs — on `/es/series` and
 * `/es/tags` the entire list was the English one, so not a single step was the
 * page emitting it, while the canonical three lines above said `/es/…`. One
 * `<head>` contradicting itself is worse than a missing `BreadcrumbList`.
 *
 * The name is the one the section already renders as its own heading, read from
 * the same catalogue the header reads (`app/lib/catalog.ts`) — through
 * `STRINGS[locale]` rather than `useStrings()`, because `meta()` is not a
 * component and cannot call a hook. So `/blog` is *Articles*, which is what that
 * page has always been titled and what the trail said in neither Locale.
 *
 * The home page's step has no trailing slash in English — `withLocale("/", …)`
 * gives the empty string there — and that is deliberate: it matches, character
 * for character, the canonical the home page declares for itself. A trail that
 * named `https://poschuler.com/` while the page called itself
 * `https://poschuler.com` would be two URLs for one page in one document.
 */
export function siteCrumb(section: SiteSection, locale: Locale): Crumb {
  const strings = STRINGS[locale];

  return {
    name: section === "home" ? strings.home.crumb : strings[section].heading,
    path: withLocale(SECTION_PATH[section], locale),
  };
}

export type ArticleFacts = {
  /** This article's own absolute address — `alternates.ts`'s `canonical`, not built again here. */
  url: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD`. */
  datePublished: string;
  /** The most recent Revision's date, or nothing when the document has none. */
  dateRevised?: string;
  /** The Series this is a Part of, when it has one. */
  seriesSlug?: string | null;
  /** The Project this is a Field Note of, when it has one. */
  projectSlug?: string | null;
  /** This article's own Locale — needed only to address its Container, not itself. */
  locale: Locale;
};

/**
 * An article, whether it stands alone, is a Part, or is a Field Note.
 *
 * `BlogPosting` rather than `TechArticle`: Google treats them the same for rich
 * results, and `BlogPosting` is what the rest of the ecosystem understands.
 *
 * `dateModified` falls back to `datePublished` rather than being omitted. An
 * article with no Revision has not changed since it was published, which is a
 * fact worth stating — leaving the field out invites the crawler to guess from
 * the response headers, which describe the deploy rather than the writing.
 *
 * `seriesSlug` and `projectSlug` are mutually exclusive, the same way the two
 * columns they are read from are: a Post has one Container or none. Both are
 * accepted here rather than a single discriminated union because every caller
 * already has the row shape `content.server.ts` returns, with both columns
 * present and one of them `null`.
 */
export function blogPosting({
  url,
  title,
  description,
  datePublished,
  dateRevised,
  seriesSlug,
  projectSlug,
  locale,
}: ArticleFacts): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: title,
    description,
    url,
    mainEntityOfPage: url,
    datePublished,
    dateModified: dateRevised ?? datePublished,
    image: `${SITE}/og.png`,
    inLanguage: locale,
    // The same entity twice, and both named: he is the author and there is no
    // publisher between him and the reader. The shared `@id` is what merges
    // these with the full `Person` on the home page and the Resume.
    author: AUTHOR,
    publisher: AUTHOR,
    ...(seriesSlug
      ? { isPartOf: { "@id": seriesId(seriesSlug, locale) } }
      : projectSlug
        ? { isPartOf: { "@id": projectId(projectSlug, locale) } }
        : {}),
  };
}

/** The identifier a Part points at, and the landing declares. */
export function seriesId(slug: string, locale: Locale): string {
  return `${SITE}${seriesHref(slug, locale)}#series`;
}

/**
 * The identifier a Field Note points at — the Project it is written about.
 *
 * The Project landing declares no JSON-LD of its own (out of scope for 1b/7),
 * so this is not a fragment like `seriesId`'s: a `#project` suffix would be an
 * `@id` nothing in the site's structured data graph ever defines, which is a
 * dangling reference for a crawler resolving it. The landing's own URL is a
 * real resource instead — the page a Field Note's `isPartOf` names is one that
 * exists, even without a JSON-LD node to greet it there yet.
 */
export function projectId(slug: string, locale: Locale): string {
  return `${SITE}${projectHref(slug, locale)}`;
}

export type SeriesFacts = {
  slug: string;
  title: string;
  description: string;
  locale: Locale;
  /** In reading order, which is the order that makes `position` mean anything. */
  parts: Array<{ slug: string; title: string }>;
};

/**
 * The Series landing.
 *
 * `hasPart` lists what is published and nothing else — a planned Section has no
 * URL and no title a crawler could use, and announcing it here would be the
 * same claim about the future the pages themselves refuse to make.
 */
export function creativeWorkSeries({ slug, title, description, locale, parts }: SeriesFacts): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWorkSeries",
    "@id": seriesId(slug, locale),
    name: title,
    description,
    url: `${SITE}${seriesHref(slug, locale)}`,
    inLanguage: locale,
    author: AUTHOR,
    hasPart: parts.map((part, index) => {
      const partUrl = `${SITE}${postHref({ slug: part.slug, seriesSlug: slug }, locale)}`;

      return {
        "@type": "BlogPosting",
        "@id": `${partUrl}#article`,
        name: part.title,
        url: partUrl,
        position: index + 1,
      };
    }),
  };
}
