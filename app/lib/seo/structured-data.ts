import { AUTHOR, PERSON_ID, SITE } from "./person";

/**
 * The JSON-LD objects the site emits, all of them **derived** from what is
 * already in D1 or KV.
 *
 * No hand-written block per page: structured data that is typed out beside the
 * content it describes agrees with it exactly once, on the day it is written.
 * These builders take the same values the page renders, so the two cannot say
 * different things.
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

/** The path of URLs to the home page, which every other list starts from. */
export const HOME_CRUMB: Crumb = { name: "Home", path: "/" };

export type ArticleFacts = {
  path: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD`. */
  datePublished: string;
  /** The most recent Revision's date, or nothing when the document has none. */
  dateRevised?: string;
  /** The Series this is a Part of, when it has one. */
  seriesSlug?: string | null;
};

/**
 * An article, whether it stands alone or is a Part.
 *
 * `BlogPosting` rather than `TechArticle`: Google treats them the same for rich
 * results, and `BlogPosting` is what the rest of the ecosystem understands.
 *
 * `dateModified` falls back to `datePublished` rather than being omitted. An
 * article with no Revision has not changed since it was published, which is a
 * fact worth stating — leaving the field out invites the crawler to guess from
 * the response headers, which describe the deploy rather than the writing.
 */
export function blogPosting({
  path,
  title,
  description,
  datePublished,
  dateRevised,
  seriesSlug,
}: ArticleFacts): JsonLd {
  const url = `${SITE}${path}`;

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
    inLanguage: "en",
    // Both point at the one Person entity rather than restating him. He is the
    // author and there is no publisher between him and the reader.
    author: AUTHOR,
    publisher: { "@id": PERSON_ID },
    ...(seriesSlug ? { isPartOf: { "@id": seriesId(seriesSlug) } } : {}),
  };
}

/** The identifier a Part points at, and the landing declares. */
export function seriesId(slug: string): string {
  return `${SITE}/series/${slug}#series`;
}

export type SeriesFacts = {
  slug: string;
  title: string;
  description: string;
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
export function creativeWorkSeries({ slug, title, description, parts }: SeriesFacts): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWorkSeries",
    "@id": seriesId(slug),
    name: title,
    description,
    url: `${SITE}/series/${slug}`,
    inLanguage: "en",
    author: AUTHOR,
    hasPart: parts.map((part, index) => ({
      "@type": "BlogPosting",
      "@id": `${SITE}/series/${slug}/${part.slug}#article`,
      name: part.title,
      url: `${SITE}/series/${slug}/${part.slug}`,
      position: index + 1,
    })),
  };
}
