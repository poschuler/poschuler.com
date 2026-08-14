/**
 * The KV key layout, in one place.
 *
 * `kv-bulk-upload.ts` derives keys to upload them, the test setup derives them
 * to seed a local namespace, and the two used to hold separate copies of the
 * same three lines. A key layout with two implementations has two chances to
 * drift.
 *
 * Payloads sit in a directory per kind, and the directory decides the prefix —
 * the same rule the content trees follow (ADR 0004), for the same reason: a
 * name alone cannot be checked, a location can.
 *
 * The prefix says what kind of payload it is, **not** which URL serves it. A
 * Field Note is a Post served under `/projects/`, and its body belongs in
 * `blog:` like every other Post body; a route that reads a body must not have
 * to guess which key space to try.
 */

/** Payload directory → key prefix. */
const PREFIXES: Record<string, string> = {
  blog: "blog",
  projects: "project",
};

/**
 * `blog/<slug>.<locale>.json` → `blog:<slug>:<locale>`,
 * `projects/<slug>.<locale>.json` → `project:<slug>:<locale>`.
 * The sitemap stands alone at the root.
 *
 * Takes the path relative to `kv_payloads/`, on either separator.
 */
export function kvKeyFor(relativePath: string): string | null {
  const segments = relativePath.split(/[\\/]/);

  if (segments.length === 1 && segments[0] === "sitemap.json") {
    return "sitemap";
  }

  if (segments.length !== 2) {
    return null;
  }

  const [directory, filename] = segments;
  const prefix = PREFIXES[directory];

  if (!prefix) {
    return null;
  }

  const base = filename.replace(/\.json$/, "");
  const parts = base.split(".");
  const locale = parts.pop();
  const slug = parts.join(".");

  if (!slug || !locale) {
    return null;
  }

  return `${prefix}:${slug}:${locale}`;
}

/** Every prefix this repository writes, for the upload script's prune. */
export const KV_PREFIXES = Object.values(PREFIXES);
