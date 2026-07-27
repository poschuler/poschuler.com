/**
 * Minimal sitemap renderer following the sitemaps.org 0.9 protocol.
 *
 * Only the fields this site actually publishes are supported: `loc`,
 * `lastmod`, `changefreq` and `priority`. No image, video or news
 * extensions, so the document declares a single namespace.
 */

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type SitemapRoute = {
  /** Path relative to the domain, with or without a leading slash. */
  url: string;
  /** ISO date (`YYYY-MM-DD`) of the last modification. */
  lastmod?: string;
  changefreq?: ChangeFrequency;
  /** Between 0.0 and 1.0. */
  priority?: number;
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

  return `<url>${tags.join("")}</url>`;
}

export function generateSitemap({ domain, routes }: SitemapOptions): string {
  const origin = domain.replace(/\/+$/, "");
  const urls = routes.map((route) => renderUrl(origin, route)).join("");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls +
    "</urlset>"
  );
}
