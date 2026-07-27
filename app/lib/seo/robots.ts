/**
 * Minimal `robots.txt` renderer.
 *
 * Emits one block per group, in the field order crawlers expect:
 * `User-agent`, `Crawl-delay`, `Allow`, `Disallow`, `Sitemap`.
 * Empty or omitted fields are skipped entirely.
 */

export type RobotsGroup = {
  userAgent: string;
  crawlDelay?: number;
  allow?: string[];
  disallow?: string[];
  sitemap?: string[];
};

function renderGroup(group: RobotsGroup): string {
  const lines = [`User-agent: ${group.userAgent}`];

  if (group.crawlDelay !== undefined) {
    lines.push(`Crawl-delay: ${group.crawlDelay}`);
  }

  for (const path of group.allow ?? []) {
    lines.push(`Allow: ${path}`);
  }

  for (const path of group.disallow ?? []) {
    lines.push(`Disallow: ${path}`);
  }

  for (const url of group.sitemap ?? []) {
    lines.push(`Sitemap: ${url}`);
  }

  return lines.join("\n");
}

export function generateRobotsTxt(groups: RobotsGroup[] = []): string {
  return groups.map(renderGroup).join("\n\n");
}
