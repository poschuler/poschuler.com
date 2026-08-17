/**
 * Minimal sitemap renderer following the sitemaps.org 0.9 protocol.
 *
 * Only the fields this site actually publishes are supported: `loc`,
 * `lastmod`, `changefreq`, `priority` and, since Part 10 of
 * `evolution-plan/15-phase-3-spanish.md`, the `xhtml` alternates below. No
 * image, video or news extensions, so the document declares no namespace for
 * either of those.
 *
 * **Two namespaces, not one.** This used to declare a single one and say so
 * deliberately. `hreflang` needs the `xhtml` namespace's own
 * `<xhtml:link rel="alternate">`, and with fifteen pages across two Locales a
 * `hreflang` pointing at a URL that does not point back is invisible unless
 * both sides sit in one file — which this one already is, compared byte for
 * byte against a fresh regeneration in CI (`check:fixtures`), so the
 * reciprocity check is free from here on.
 */

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

/**
 * One `<xhtml:link rel="alternate">` inside a `<url>`. `hreflang` is a Locale
 * or the literal `"x-default"` — a plain string here rather than the `Locale`
 * union, because this module knows nothing about the app's domain (see the
 * docblock above); the caller is what carries that type.
 */
export type SitemapAlternate = {
  hreflang: string;
  /** Absolute — unlike `SitemapRoute.url`, never joined with `domain`. */
  href: string;
};

export type SitemapRoute = {
  /** Path relative to the domain, with or without a leading slash. */
  url: string;
  /** ISO date (`YYYY-MM-DD`) of the last modification. */
  lastmod?: string;
  changefreq?: ChangeFrequency;
  /** Between 0.0 and 1.0. */
  priority?: number;
  /**
   * Reciprocal by construction, not by this module's doing — it renders
   * whatever the caller hands it. Absent or empty for a document with no
   * counterpart in another Locale (a Tag page, which carries none at all).
   */
  alternates?: SitemapAlternate[];
};

export type SitemapOptions = {
  /** Origin without a trailing slash, e.g. `https://poschuler.com`. */
  domain: string;
  routes: SitemapRoute[];
};

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character]!);
}

function renderAlternate(alternate: SitemapAlternate): string {
  return `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`;
}

function renderUrl(domain: string, route: SitemapRoute): string {
  const path = route.url.startsWith("/") ? route.url : `/${route.url}`;
  const tags = [`<loc>${escapeXml(domain + path)}</loc>`];

  if (route.lastmod) {
    tags.push(`<lastmod>${route.lastmod}</lastmod>`);
  }

  if (route.changefreq) {
    tags.push(`<changefreq>${route.changefreq}</changefreq>`);
  }

  if (route.priority !== undefined) {
    tags.push(`<priority>${route.priority}</priority>`);
  }

  for (const alternate of route.alternates ?? []) {
    tags.push(renderAlternate(alternate));
  }

  return `<url>${tags.join("")}</url>`;
}

export function generateSitemap({ domain, routes }: SitemapOptions): string {
  const origin = domain.replace(/\/+$/, "");
  const urls = routes.map((route) => renderUrl(origin, route)).join("");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    urls +
    "</urlset>"
  );
}
