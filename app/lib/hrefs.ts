/**
 * Where a Content Item is served from.
 *
 * A Field Note lives under its Project and a loose Post under `/blog`, and what
 * tells them apart is a column — `project_slug` — rather than anything the file
 * declares (ADR 0007). Every list on the site interleaves the two: `/timeline`,
 * the home page's recent writing, and `/blog` itself.
 *
 * One function rather than a conditional at each call site. `ContentItem`
 * hardcoded `` `/blog/${item.slug}` ``, and that single line is what the columns
 * exist to feed — a second copy of the rule is a Field Note linking
 * to a 404 from whichever list nobody checked.
 *
 * Every function here now takes a Locale too, and stays the one place a
 * relative path is built: `app/lib/seo/alternates.ts` composes an absolute
 * address out of what this module returns rather than reconstructing the
 * segment itself, and so does every route that used to type one out by hand.
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
 * The same rule, for a `<Link to>` rather than for an address.
 *
 * The difference is the one path `withLocale` deliberately returns empty: the
 * English root is `""`, because `alternates.ts` composes `${SITE}${path}` and
 * has to land on the origin exactly. Handed to React Router, that empty string
 * is not the root at all — an empty relative path resolves to *the current
 * location*. A 404 page's way out, written as `withLocale("/", locale)`, was
 * measured rendering `href="/the-address-that-404ed"`: the one link on the
 * page that promised to lead somewhere led back to where the reader already
 * was, in English only, which is why a pass over the Spanish branch went
 * straight past it.
 *
 * Every other path is identical in both functions, so navigation can call this
 * one for the whole of a list without the root being a special case at each
 * call site.
 */
export function navHref(path: string, locale: Locale): string {
  return withLocale(path, locale) || "/";
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
 * A Post, wherever it is served: a Field Note under its Project, or `/blog`.
 *
 * `projectSlug` is optional — a loose Post has none, and repeating `null` at
 * every caller would say nothing a default does not already say.
 */
export function postHref(
  post: {
    slug: string;
    projectSlug?: string | null;
  },
  locale: Locale,
): string {
  if (post.projectSlug) {
    return `${projectHref(post.projectSlug, locale)}/${post.slug}`;
  }

  return withLocale(`/blog/${post.slug}`, locale);
}
