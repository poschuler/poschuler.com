/**
 * Markdown front matter → the SQL that seeds the `content` table.
 *
 * Pure on purpose: no disk, no `process.cwd()`, no logging. `generate-seed-sql.ts`
 * does the reading and the writing and calls in here for every decision, which
 * is what makes the decisions testable — the rules below are load-bearing for
 * production data and used to be reachable only by running the script and
 * reading its output.
 */

import { validateRevisions } from "../../app/lib/revisions.ts";
import { declaredTypeMatchesTree, treeOf } from "./content-tree.ts";

/**
 * The last segment of a path, on either separator.
 *
 * Not `node:path.basename`, which resolves against the platform the generator
 * happens to run on — the same content must produce the same `seed.sql`
 * everywhere, because CI compares it against the committed file byte for byte.
 */
function basenameOf(relativePath: string): string {
  const segments = relativePath.split(/[\\/]/);
  return segments[segments.length - 1];
}

export interface FrontMatterAttributes {
  type: "post" | "link";
  repository: string;
  title: string;
  publishedAt: string;
  description?: string;
  externalUrl?: string;
  source?: string;
  tags?: string[];
  /**
   * `unknown` rather than `Revision[]`: this is a YAML field, so the type here
   * would be a claim about a file nobody has checked. `validateRevisions` is
   * what turns it into a list.
   */
  updates?: unknown;
}

/** A row that will be seeded, and the identity used to decide it survives a prune. */
export type SeededRow = {
  statement: string;
  /**
   * `slug:lang` for a Post, `slug:` for a Bookmark. A Slug alone does not
   * identify a Post — `(Slug, Locale)` does — and a Bookmark has no Locale.
   */
  key: string;
};

/** A Markdown file that produces no row, and why — a state the seed tolerates. */
export type SkippedFile = { reason: string };

/**
 * A Markdown file that produces no row and must stop the build.
 *
 * Distinct from a skip on purpose (ADR 0004): an unpublished draft is a warning
 * nobody needs to act on, while a file whose tree and declared type disagree is
 * a mistake that used to publish an empty page in silence.
 */
export type InvalidFile = { error: string };

export type ContentFileResult = SeededRow | SkippedFile | InvalidFile;

export function isSkipped(result: ContentFileResult): result is SkippedFile {
  return "reason" in result;
}

export function isInvalid(result: ContentFileResult): result is InvalidFile {
  return "error" in result;
}

/**
 * Single quotes are doubled; everything else goes through verbatim. Nothing
 * here is user-supplied — the input is Markdown in this repository, reviewed as
 * a diff — but a title with an apostrophe is ordinary and would otherwise end
 * the string literal.
 */
export function escapeSql(text: string | undefined): string {
  if (text === undefined || text === null) return "NULL";
  return `'${text.replace(/'/g, "''")}'`;
}

/**
 * `<slug>.<locale>.md` → slug and Locale; `<slug>.md` → slug alone.
 *
 * Only `en` and `es` are recognised as a Locale. A filename like
 * `post.en-old.md` therefore parses as the slug `post.en-old` with no Locale,
 * which is how a draft ends up silently unpublished — see the Post branch of
 * `contentRowFor`.
 */
export function parseContentFilename(
  filename: string,
): { slug: string; lang: string | null } | null {
  const match = filename.match(/^(.*?)(?:\.(en|es))?\.md$/);

  if (!match) {
    return null;
  }

  return { slug: match[1], lang: match[2] || null };
}

/**
 * The `INSERT OR REPLACE` for one Markdown file, or the reason there is none.
 *
 * Takes the path relative to `app/content`, not a bare filename: the directory
 * decides what the file is and the filename gives its Slug (ADR 0004). Those
 * are two separate readings of the same path, and before this only the second
 * one happened.
 */
export function contentRowFor(
  relativePath: string,
  attributes: FrontMatterAttributes,
): ContentFileResult {
  const tree = treeOf(relativePath);

  if (tree === null) {
    return {
      error: `${relativePath} is not under a content tree — nothing would read it and nothing would say so`,
    };
  }

  if (tree === "projects") {
    return { error: `${relativePath} is a Project and does not belong in the content table` };
  }

  if (!declaredTypeMatchesTree(attributes.type, tree)) {
    return {
      error: `${relativePath} declares type '${attributes.type}' but sits in the ${tree} tree`,
    };
  }

  const filename = basenameOf(relativePath);
  const parsed = parseContentFilename(filename);

  if (!parsed) {
    return { reason: `could not parse slug and lang from ${filename}` };
  }

  const { slug, lang } = parsed;
  const tagsJson = escapeSql(JSON.stringify(attributes.tags || []));
  const escapedSlug = escapeSql(slug);
  const publishedAt = escapeSql(attributes.publishedAt);
  const title = escapeSql(attributes.title);

  if (attributes.type === "post") {
    if (!lang) {
      return { reason: `post ${filename} must have a language in its filename` };
    }

    const revisions = validateRevisions(attributes.updates);

    if ("error" in revisions) {
      return { error: `${relativePath}: ${revisions.error}` };
    }

    return {
      statement: `
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, updated_at)
VALUES (${escapedSlug}, ${escapeSql(lang)}, 'post', ${title}, ${escapeSql(attributes.description)}, ${publishedAt}, ${tagsJson}, ${escapeSql(attributes.repository)}, ${escapeSql(JSON.stringify(revisions.revisions))}, CURRENT_TIMESTAMP);
`,
      key: `${slug}:${lang}`,
    };
  }

  // A Bookmark is a pointer; its body lives at the Source and is not yours to
  // revise. Declaring `updates` on one is a misunderstanding worth failing on
  // rather than ignoring, because ignoring it looks identical to working.
  if (attributes.updates !== undefined) {
    return { error: `${relativePath} is a Bookmark and cannot carry updates — the body is not here` };
  }

  return {
    statement: `
INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES (${escapedSlug}, NULL, 'link', ${title}, ${escapeSql(attributes.externalUrl)}, ${escapeSql(attributes.source)}, ${publishedAt}, ${tagsJson}, CURRENT_TIMESTAMP);
`,
    key: `${slug}:`,
  };
}

/**
 * Inserts first, prune last — never `DELETE FROM content` up front.
 *
 * Applied to the remote database a leading truncate empties the live table and
 * the site serves an empty Timeline until the inserts land. The partial unique
 * indexes on `(slug, lang)` and `(slug)` make `INSERT OR REPLACE` a genuine
 * upsert, so nothing needs clearing for this to stay idempotent, and the
 * closing `DELETE` removes only rows no Markdown file backs any more.
 */
export function buildSeedSql(rows: SeededRow[]): string {
  const statements = rows.map((row) => row.statement).join("");
  const keyList = rows.map((row) => escapeSql(row.key)).join(", ");

  return `${statements}
DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN (${keyList});
`;
}
