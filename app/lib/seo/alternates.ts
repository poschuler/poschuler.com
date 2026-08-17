/**
 * Relative, and every import below it too, `.ts` extension included —
 * `seed/kv/sitemap-routes.ts` imports this module directly, and Node runs that
 * script with no alias resolution (`tsconfig.test.json`'s own note on the same
 * constraint). An alias would work everywhere this module is bundled and break
 * the one place it is not.
 */
import type { Locale } from "../../context.ts";
import { postHref, projectHref, seriesHref, withLocale } from "../hrefs.ts";
import { SITE } from "./person.ts";

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
   *
   * Read through `hreflangEntries` below rather than directly: both consumers
   * — the document head and the sitemap — declare the same set, and that is
   * what makes the two halves of a `hreflang` pair agree.
   */
  alternates: Alternate[];
  /** The English address — the root, with no prefix. It is what `x-default` names (ADR 0010). */
  xDefault: string;
};

/** One declared equivalence: a `hreflang` value and the address it names. */
export type HreflangEntry = { hreflang: string; href: string };

/**
 * Every `hreflang` a document declares — one per Locale it exists in, this
 * page's own included, and `x-default` last.
 *
 * **The one definition of that set**, because it is asserted in two places and
 * a crawler compares them: a `<link rel="alternate">` in the document head and
 * an `<xhtml:link>` inside the sitemap's `<url>`. They were composed separately
 * for one publication and the head's half was simply never written — the
 * sitemap declared pairs no page confirmed, which is the shape of `hreflang`
 * that gets ignored outright. Whatever this returns, both emit.
 *
 * Independent of which Locale is asking: `alternates` and `xDefault` are built
 * from `existingLocales` alone, so the sitemap computes this once per document
 * and reuses it for every Locale's own entry.
 */
export function hreflangEntries(addresses: DocumentAddresses): HreflangEntry[] {
  return [
    ...addresses.alternates.map(({ locale, href }) => ({ hreflang: locale, href })),
    { hreflang: "x-default", href: addresses.xDefault },
  ];
}

/**
 * The same set as `<link>` descriptors, spread into a route's own `meta`
 * array — `...alternateLinks(addresses)`, the way `emptyIndexRobots` composes.
 * Thirteen routes emit these, and none of them writes the rule out.
 *
 * **The key is `hreflang`, lower-case, and that was checked in a built page
 * rather than assumed.** A descriptor carrying `tagName` is handed to React as
 * props, which invites the React spelling `hrefLang` — and React passes that
 * through verbatim, so the served attribute reads `hrefLang` too. HTML lowers
 * attribute names when it parses, so both work; only one of them is the name
 * the specification uses and the one the sitemap already writes.
 *
 * A document that exists in one Locale still declares that Locale and an
 * `x-default` naming the same address. That is not noise: it is the page
 * confirming what the sitemap says about it, and it is what makes the pair
 * reciprocal the day a Translation is added to the other side.
 */
export function alternateLinks(
  addresses: DocumentAddresses,
): { tagName: "link"; rel: "alternate"; hreflang: string; href: string }[] {
  return hreflangEntries(addresses).map(({ hreflang, href }) => ({
    tagName: "link",
    rel: "alternate",
    hreflang,
    href,
  }));
}

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
 * The section a document belongs to, for the one case `switcherDestination`
 * below needs it: a document with no Translation, which sends a reader to
 * that section's index rather than to a 404 (Part 6 and Part 9 of
 * `evolution-plan/15-phase-3-spanish.md`). Typed over the three kinds that can
 * lack a Translation — an `index` never can, so `switcherDestination` never
 * calls this for one.
 */
export type SwitcherSection = "blog" | "series" | "projects";

function fallbackSection(
  identity: Exclude<DocumentIdentity, { kind: "index" }>,
): { path: string; section: SwitcherSection } {
  switch (identity.kind) {
    case "post":
      return { path: "/blog", section: "blog" };
    case "series":
      return { path: "/series", section: "series" };
    case "project":
      return { path: "/projects", section: "projects" };
  }
}

export type SwitcherDestination = {
  /** Where `<Link to>` should navigate — relative, the same shape every other function here returns. */
  href: string;
  /** The Locale the destination is written in — what `lang` and `hrefLang` both declare on the link. */
  locale: Locale;
  /**
   * `null` when the destination is this very document, translated: the label
   * is just the other Locale's own name. Otherwise the section the switcher
   * fell back to, so the caller — which owns every interface string (ADR
   * 0011) — can compose "Blog en español" instead of a silent link.
   */
  section: SwitcherSection | null;
};

/**
 * Where the language switcher sends a reader, and what to call the trip (Part
 * 9 of `evolution-plan/15-phase-3-spanish.md`).
 *
 * Reads the exact `existingLocales` a route's own `documentAddresses` call
 * already computed — never queried again here — so the switcher and the
 * `hreflang` cannot disagree about which Locales exist for one document. An
 * `index` never reads it at all: Part 6 makes every index exist in every
 * Locale unconditionally, which is a fact about the route rather than
 * something a query could contradict — `/cv` included, mounted in both
 * branches (ADR 0010) before Part 8 gives it Spanish text of its own.
 *
 * Not a pair and not a dropdown: with two Locales this is the whole switcher,
 * one link to whichever Locale the caller is not currently reading.
 */
export function switcherDestination(
  identity: DocumentIdentity,
  locale: Locale,
  existingLocales: readonly Locale[],
): SwitcherDestination {
  const target: Locale = locale === "en" ? "es" : "en";

  if (identity.kind === "index" || existingLocales.includes(target)) {
    return { href: relativePath(identity, target), locale: target, section: null };
  }

  const fallback = fallbackSection(identity);

  return { href: withLocale(fallback.path, target), locale: target, section: fallback.section };
}

/**
 * The one `<meta name="robots">` descriptor an empty index adds to its own
 * `meta()` (Part 6 of `evolution-plan/15-phase-3-spanish.md`): nothing thin
 * enters the index, and `follow` still lets the crawler walk on to wherever
 * the index's own empty state points.
 *
 * An empty array when the list is not empty, so `...emptyIndexRobots(...)`
 * composes into every index's `meta` array without an `if` at the call site —
 * one line, shared by `/blog`, `/projects`, `/series` and `/tags` rather than
 * the same conditional written out four times.
 */
export function emptyIndexRobots(isEmpty: boolean): { name: "robots"; content: string }[] {
  return isEmpty ? [{ name: "robots", content: "noindex, follow" }] : [];
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
