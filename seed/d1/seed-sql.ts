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
import { basenameOf, declaredTypeMatches, isMisplaced, placementOf } from "./content-tree.ts";

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

/**
 * Where a Part sits in its Series, as the manifest says.
 *
 * It arrives as an argument rather than being read from front matter, and that
 * is the decision itself (ADR 0007): a Part does not know where it is. The
 * manifest lists the Parts of each section, in order, and the generator turns
 * those lists into these three values.
 */
export interface PartPlacement {
  seriesSlug: string;
  section: string;
  /** The position in its section's list — an index, never written by hand. */
  order: number;
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
 * decides what the file is, how deep it sits decides whether it is inside a
 * Container, and the filename gives its Slug (ADR 0004). Those are separate
 * readings of the same path, and before this only the last one happened.
 *
 * `part` is supplied by the caller for a Post that lives inside a Series,
 * because only the manifest knows where it sits. A nested Post without one is a
 * Part nothing indexes, which is a failure rather than a loose Post.
 */
export function contentRowFor(
  relativePath: string,
  attributes: FrontMatterAttributes,
  part?: PartPlacement,
): ContentFileResult {
  const placed = placementOf(relativePath);

  if (isMisplaced(placed)) {
    return { error: placed.error };
  }

  if (placed.type === "project" || placed.type === "series") {
    return {
      error: `${relativePath} is a ${placed.type} and does not belong in the content table`,
    };
  }

  if (!declaredTypeMatches(attributes.type, placed)) {
    return {
      error: `${relativePath} declares type '${attributes.type}' but its position in the ${placed.tree} tree says '${placed.type}'`,
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

    // After the Locale check, deliberately: a draft that carries no Locale is
    // not seeded at all, so the manifest has no reason to list it.
    if (placed.container !== null && !part) {
      return {
        error: `${relativePath} is not listed in the ${placed.container} manifest — a Part nothing indexes cannot be reached or ordered`,
      };
    }

    const revisions = validateRevisions(attributes.updates);

    if ("error" in revisions) {
      return { error: `${relativePath}: ${revisions.error}` };
    }

    // Written here or written as NULL, never read from front matter. The three
    // always travel together, which is why the invariant that they are all
    // present or all absent is not checked anywhere: it is not representable.
    const container = part
      ? `${escapeSql(part.seriesSlug)}, ${escapeSql(part.section)}, ${part.order}`
      : "NULL, NULL, NULL";

    return {
      statement: `
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updates, series_slug, series_section, section_order, updated_at)
VALUES (${escapedSlug}, ${escapeSql(lang)}, 'post', ${title}, ${escapeSql(attributes.description)}, ${publishedAt}, ${tagsJson}, ${escapeSql(attributes.repository)}, ${escapeSql(JSON.stringify(revisions.revisions))}, ${container}, CURRENT_TIMESTAMP);
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
 * The identities claimed by more than one file.
 *
 * `content` is unique on `(slug, lang)` **site-wide**, not per tree, so a Part
 * named `project-setup` competes with every loose Post and every future Field
 * Note. The database would catch it — as a constraint violation partway through
 * seeding the deployed store, naming a row rather than a file. This catches it
 * on the developer's machine, before the SQL is written.
 */
export function duplicateKeys(rows: SeededRow[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.key)) {
      duplicates.add(row.key);
    }

    seen.add(row.key);
  }

  return [...duplicates];
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
