/**
 * Where a Content Item is served from.
 *
 * A Part lives under its Series, a loose Post under `/blog`, and what tells
 * them apart is a column — `content.series_slug` — rather than anything the
 * file declares (ADR 0007). Every list on the site interleaves the two:
 * `/timeline`, the home page's recent writing, and `/blog` itself.
 *
 * One function rather than a conditional at each call site. `ContentItem`
 * hardcoded `` `/blog/${item.slug}` ``, and that single line is what the column
 * exists to feed — a second copy of the rule is a Part linking to a 404 from
 * whichever list nobody checked.
 *
 * Pure and client-safe on purpose: the components that build these links are
 * bundled for the browser and cannot reach into `~/models/*.server`.
 */

/** The Series landing — the page that holds the contract and the whole arc. */
export function seriesHref(seriesSlug: string): string {
  return `/series/${seriesSlug}`;
}

/**
 * A Tag's page. The segment is the Tag verbatim: a Tag *is* its Slug, checked
 * against a closed vocabulary by the seed generator, so there is nothing to
 * encode and nothing to derive — a Tag that needed escaping here would have
 * failed the build.
 */
export function tagHref(tag: string): string {
  return `/tags/${tag}`;
}

/** A Post, wherever it is served: a Part under its Series, or `/blog`. */
export function postHref(post: { slug: string; seriesSlug: string | null }): string {
  return post.seriesSlug ? `${seriesHref(post.seriesSlug)}/${post.slug}` : `/blog/${post.slug}`;
}
