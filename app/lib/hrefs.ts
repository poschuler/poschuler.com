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
 * Every function here now takes a Locale too (Part 10 of
 * `evolution-plan/15-phase-3-spanish.md`), and stays the one place a relative
 * path is built: `app/lib/seo/alternates.ts` composes an absolute address out
 * of what this module returns rather than reconstructing the segment itself,
 * and so does every route that used to type one out by hand.
 *
 * Pure and client-safe on purpose: the components that build these links are
 * bundled for the browser and cannot reach into `~/models/*.server`.
 */

/**
 * Relative, not `~/context` — `app/lib/seo/alternates.ts` is imported directly
 * by `seed/kv/sitemap-routes.ts`, which Node runs as a plain script with no
 * alias resolution (`tsconfig.test.json`'s own note on the same constraint).
 * An alias here would work everywhere this module is bundled and break the one
 * place it is not.
 */
import { ES_PREFIX, type Locale } from "../context.ts";

/**
 * The `/es` prefix every function below funnels through, so the two branches
 * cannot disagree about what marks the Spanish one.
 *
 * The root is the one path that is not `${ES_PREFIX}${path}`, in either
 * direction. `prefix("es", [route("/", …)])` produces exactly `/es`, with no
 * trailing slash (ADR 0010, confirmed against the generated registry) —
 * `${ES_PREFIX}/` would be wrong by one character. And the English root is the
 * empty string, not `/`: `${SITE}/` is not the address this site's own
 * canonical has ever declared, so `alternates.ts` composing `${SITE}${path}`
 * has to be handed `""` to land on `${SITE}` exactly.
 *
 * Exported for `app/lib/seo/alternates.ts`, which localises the literal path of
 * a page with no document behind it — an index, a listing, the home page —
 * rather than reconstructing this rule a second time.
 */
export function withLocale(path: string, locale: Locale): string {
  if (path === "/") {
    return locale === "es" ? ES_PREFIX : "";
  }

  return locale === "es" ? `${ES_PREFIX}${path}` : path;
}

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
export function seriesHref(seriesSlug: string, locale: Locale): string {
  return withLocale(`/series/${seriesSlug}`, locale);
}

/** The Project landing — the case study a Field Note is framed by. */
export function projectHref(projectSlug: string, locale: Locale): string {
  return withLocale(`/projects/${projectSlug}`, locale);
}

/**
 * A Tag's page. The segment is the Tag verbatim: a Tag *is* its Slug, checked
 * against a closed vocabulary by the seed generator, so there is nothing to
 * encode and nothing to derive — a Tag that needed escaping here would have
 * failed the build.
 */
export function tagHref(tag: string, locale: Locale): string {
  return withLocale(`/tags/${tag}`, locale);
}

/**
 * A Post, wherever it is served: a Part under its Series, a Field Note under
 * its Project, or `/blog`.
 *
 * `projectSlug` is optional — most callers only ever hand this a Post inside
 * a Series' own arc, where a Field Note cannot appear, and repeating `null`
 * at every one of them would say nothing a default does not already say.
 */
export function postHref(
  post: {
    slug: string;
    seriesSlug: string | null;
    projectSlug?: string | null;
  },
  locale: Locale,
): string {
  const container = containerOf({ seriesSlug: post.seriesSlug, projectSlug: post.projectSlug ?? null });

  if (container?.kind === "series") {
    return `${seriesHref(container.slug, locale)}/${post.slug}`;
  }

  if (container?.kind === "project") {
    return `${projectHref(container.slug, locale)}/${post.slug}`;
  }

  return withLocale(`/blog/${post.slug}`, locale);
}
