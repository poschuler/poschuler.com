/**
 * The KV key layout, in one place.
 *
 * `kv-bulk-upload.ts` derives keys to upload them, the test setup derives them
 * to seed a local namespace, and the two used to hold separate copies of the
 * same three lines. A key layout with two implementations has two chances to
 * drift.
 */

/** A Post body: `<slug>.<locale>.json` → `blog:<slug>:<locale>`. The sitemap stands alone. */
export function kvKeyFor(filename: string): string | null {
  if (filename === "sitemap.json") {
    return "sitemap";
  }

  const base = filename.replace(/\.json$/, "");
  const parts = base.split(".");
  const locale = parts.pop();
  const slug = parts.join(".");

  if (!slug || !locale) {
    return null;
  }

  return `blog:${slug}:${locale}`;
}
