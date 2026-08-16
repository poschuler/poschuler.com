import type { Locale } from "~/context";
import { postHref, projectHref, seriesHref, withLocale } from "~/lib/hrefs";
import { SITE } from "./person";

/**
 * A document's canonical, its reciprocal alternates and the default — one
 * module answering the question the page head and the sitemap both ask (Part
 * 10 of `evolution-plan/15-phase-3-spanish.md`).
 *
 * The rule for what address a document has used to be written four times:
 * `app/lib/hrefs.ts`, `seed/kv/sitemap-routes.ts`, `app/lib/seo/structured-data.ts`
 * and thirteen route `meta` functions, each typing out a canonical by hand.
 * This module is the second of two that close that gap — `hrefs.ts` stays the
 * only place a *relative* path is built, and this is the only place one is
 * made absolute and given its siblings. Nothing here reconstructs a path
 * `hrefs.ts` already owns.
 */

/** What a document is, for the one purpose this module has: building its address. */
export type DocumentIdentity =
  | { kind: "post"; slug: string; seriesSlug: string | null; projectSlug?: string | null }
  | { kind: "series"; slug: string }
  | { kind: "project"; slug: string }
  /**
   * A page with no document behind it — an index, a listing, the home page.
   * `path` is the literal, Locale-invariant segment (`/blog`, `/`), the same
   * one a route's own path in `routes.ts` already names.
   */
  | { kind: "index"; path: string };

export type Alternate = { locale: Locale; href: string };

export type DocumentAddresses = {
  /** This page's own absolute URL — what `<link rel="canonical">` and `og:url` both carry. */
  canonical: string;
  /**
   * One entry per Locale that exists for this document, this page's own
   * Locale included. Reciprocal by construction: every entry here is built
   * from the same `existingLocales` the caller already knows to be true, so a
   * document that exists in one Locale never gets an alternate pointing at an
   * address that does not exist.
   */
  alternates: Alternate[];
  /** The English address — the root, with no prefix. It is what `x-default` names (ADR 0010). */
  xDefault: string;
};

function relativePath(identity: DocumentIdentity, locale: Locale): string {
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
 * A document's addresses, given its identity, the page's own Locale and the
 * Locales that exist for it.
 *
 * `existingLocales` is never queried here — it is the fact a caller already
 * has in hand: constant for an index (both, always, Part 6), or read off a
 * correlated subquery beside a document's own row. This module only composes
 * an address out of it.
 */
export function documentAddresses(
  identity: DocumentIdentity,
  locale: Locale,
  existingLocales: readonly Locale[],
): DocumentAddresses {
  const absolute = (forLocale: Locale) => `${SITE}${relativePath(identity, forLocale)}`;

  return {
    canonical: absolute(locale),
    alternates: existingLocales.map((entryLocale) => ({
      locale: entryLocale,
      href: absolute(entryLocale),
    })),
    xDefault: absolute("en"),
  };
}
