import type { Locale } from "~/context";
import { projectHref } from "~/lib/hrefs";
import type { Crumb } from "~/lib/trail";
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
 * **This module builds no URL of its own**. An article's own address arrives
 * already made — the same `canonical` the page's `<head>` carries, out of
 * `app/lib/seo/alternates.ts` — and every other address here, a Container's, comes from `~/lib/hrefs`, the one place a relative path is
 * built. What this file still owns is prepending `SITE`, exactly as
 * `alternates.ts` does — never the segment structure underneath it.
 */

/** A `<script type="application/ld+json">` payload, whatever shape it takes. */
export type JsonLd = Record<string, unknown>;

/**
 * `Crumb` lives in `~/lib/trail`, alongside `indexCrumb` — the function that
 * builds the ones a `BreadcrumbList` step needs. This module keeps only the
 * emission: the vocabulary a trail is built from is not its concern.
 */
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

export type ArticleFacts = {
  /** This article's own absolute address — `alternates.ts`'s `canonical`, not built again here. */
  url: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD`. */
  datePublished: string;
  /** The most recent Revision's date, or nothing when the document has none. */
  dateRevised?: string;
  /** The Project this is a Field Note of, when it has one. */
  projectSlug?: string | null;
  /** This article's own Locale — needed only to address its Container, not itself. */
  locale: Locale;
};

/**
 * An article, whether it stands alone or is a Field Note.
 *
 * `BlogPosting` rather than `TechArticle`: Google treats them the same for rich
 * results, and `BlogPosting` is what the rest of the ecosystem understands.
 *
 * `dateModified` falls back to `datePublished` rather than being omitted. An
 * article with no Revision has not changed since it was published, which is a
 * fact worth stating — leaving the field out invites the crawler to guess from
 * the response headers, which describe the deploy rather than the writing.
 *
 * `projectSlug` is the Post's Container, when it has one: a Post has a Project
 * or none.
 */
export function blogPosting({
  url,
  title,
  description,
  datePublished,
  dateRevised,
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
    ...(projectSlug ? { isPartOf: { "@id": projectId(projectSlug, locale) } } : {}),
  };
}

/**
 * The identifier a Field Note points at — the Project it is written about.
 *
 * The Project landing declares no JSON-LD of its own — deliberately, not by
 * omission — so this is not a fragment: a `#project` suffix
 * would be an `@id` nothing in the site's structured data graph ever defines,
 * which is a dangling reference for a crawler resolving it. The landing's own
 * URL is a real resource instead — the page a Field Note's `isPartOf` names is
 * one that exists, even without a JSON-LD node to greet it there yet.
 */
export function projectId(slug: string, locale: Locale): string {
  return `${SITE}${projectHref(slug, locale)}`;
}
