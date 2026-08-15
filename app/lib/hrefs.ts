/**
 * Where a Content Item is served from.
 *
 * A Part lives under its Series, a Field Note under its Project, a loose Post
 * under `/blog`, and what tells them apart is a column each — `series_slug`
 * and `project_slug` — rather than anything the file declares (ADR 0007). Every
 * list on the site interleaves the three: `/timeline`, the home page's recent
 * writing, and `/blog` itself.
 *
 * One function rather than a conditional at each call site. `ContentItem`
 * hardcoded `` `/blog/${item.slug}` ``, and that single line is what the columns
 * exist to feed — a second copy of the rule is a Part or a Field Note linking
 * to a 404 from whichever list nobody checked.
 *
 * Pure and client-safe on purpose: the components that build these links are
 * bundled for the browser and cannot reach into `~/models/*.server`.
 */

/**
 * A Post's Container, derived from the two columns that can each hold one —
 * `content.series_slug` and `content.project_slug`, never both (`schema.sql`).
 * Modelled as a discriminated union rather than read as a pair of nullable
 * strings, so a caller reasons about *which one, if any* rather than checking
 * two independent nullables that happen to agree.
 */
export type Container =
  | { kind: "series"; slug: string }
  | { kind: "project"; slug: string }
  | null;

function containerOf(post: {
  seriesSlug: string | null;
  projectSlug: string | null;
}): Container {
  if (post.seriesSlug) {
    return { kind: "series", slug: post.seriesSlug };
  }

  if (post.projectSlug) {
    return { kind: "project", slug: post.projectSlug };
  }

  return null;
}

/** The Series landing — the page that holds the contract and the whole arc. */
export function seriesHref(seriesSlug: string): string {
  return `/series/${seriesSlug}`;
}

/** The Project landing — the case study a Field Note is framed by. */
export function projectHref(projectSlug: string): string {
  return `/projects/${projectSlug}`;
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

/**
 * A Post, wherever it is served: a Part under its Series, a Field Note under
 * its Project, or `/blog`.
 *
 * `projectSlug` is optional — most callers only ever hand this a Post inside
 * a Series' own arc, where a Field Note cannot appear, and repeating `null`
 * at every one of them would say nothing a default does not already say.
 */
export function postHref(post: {
  slug: string;
  seriesSlug: string | null;
  projectSlug?: string | null;
}): string {
  const container = containerOf({ seriesSlug: post.seriesSlug, projectSlug: post.projectSlug ?? null });

  if (container?.kind === "series") {
    return `${seriesHref(container.slug)}/${post.slug}`;
  }

  if (container?.kind === "project") {
    return `${projectHref(container.slug)}/${post.slug}`;
  }

  return `/blog/${post.slug}`;
}
