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
import { tagError, type TagVocabulary } from "./tag-vocabulary.ts";

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

/**
 * A Content Item's row, and the `content_tag` rows its Tags become.
 *
 * The two travel together because they are one reading of one file: a Tag that
 * is not on a seeded row is a Tag no page should list, and a Content Item that
 * is skipped takes its Tags with it. Keeping them in one value is what makes
 * that true by construction rather than by two loops agreeing.
 */
export interface ContentRow extends SeededRow {
  /** One per Tag, keyed `slug:lang:tag` — empty when the file carries none. */
  tags: SeededRow[];
}

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

/**
 * What reading one Markdown file produces: a row, a skip, or a failure.
 *
 * Generic in the row so a Project — which seeds one plain row and shares the
 * other two branches — is not made to carry a Content Item's Tags.
 */
export type FileResult<Row extends SeededRow = SeededRow> = Row | SkippedFile | InvalidFile;

export type ContentFileResult = FileResult<ContentRow>;

export function isSkipped(result: FileResult): result is SkippedFile {
  return "reason" in result;
}

export function isInvalid(result: FileResult): result is InvalidFile {
  return "error" in result;
}

/**
 * Single quotes are doubled; everything else goes through verbatim. Nothing
 * here is user-supplied — the input is Markdown in this repository, reviewed as
 * a diff — but a title with an apostrophe is ordinary and would otherwise end
 * the string literal.
 */
export function escapeSql(text: string | null | undefined): string {
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
 * One `content_tag` row per Tag the file carries.
 *
 * Written for Posts and Bookmarks alike, and for a Part exactly as for a loose
 * Post: what a Tag page lists is a policy of the page, not of the data. A Part
 * carries no trace of its Container here either — that lives on its `content`
 * row, and duplicating it would be a second place for it to be wrong.
 *
 * The key is the natural key of the Content Item plus the Tag. `id_content` is
 * an autoincrement and this seed upserts with `INSERT OR REPLACE`, which
 * deletes and re-inserts on a conflict, so the id it would reference changes on
 * every run.
 *
 * The Tags have already been measured against the vocabulary by the time this
 * is called, which is what lets it write them without looking at them again.
 */
function tagRowsFor(slug: string, lang: string | null, tags: string[] | undefined): SeededRow[] {
  return (tags ?? []).map((tag) => ({
    statement: `
INSERT OR REPLACE INTO content_tag (slug, lang, tag)
VALUES (${escapeSql(slug)}, ${escapeSql(lang)}, ${escapeSql(tag)});
`,
    key: `${slug}:${lang ?? ""}:${tag}`,
  }));
}

/**
 * The `INSERT OR REPLACE` for one Markdown file, or the reason there is none.
 *
 * Takes the path relative to `app/content`, not a bare filename: the directory
 * decides what the file is, how deep it sits decides whether it is inside a
 * Container, and the filename gives its Slug (ADR 0004). Those are separate
 * readings of the same path, and before this only the last one happened.
 *
 * `vocabulary` arrives the same way a Part's placement does — as a value the
 * caller read off the disk — so a Tag this site has not declared fails in the
 * shape every other front-matter mistake already fails in, rather than in a path
 * of its own.
 *
 * `part` is supplied by the caller for a Post that lives inside a Series,
 * because only the manifest knows where it sits. A nested Post without one is a
 * Part nothing indexes, which is a failure rather than a loose Post.
 */
export function contentRowFor(
  relativePath: string,
  attributes: FrontMatterAttributes,
  vocabulary: TagVocabulary,
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
  const escapedSlug = escapeSql(slug);
  const publishedAt = escapeSql(attributes.publishedAt);
  const title = escapeSql(attributes.title);

  if (attributes.type === "post") {
    if (!lang) {
      return { reason: `post ${filename} must have a language in its filename` };
    }

    // Also after the Locale check, and for the same reason: a draft is never
    // seeded, so it is never measured against the vocabulary either. That is
    // what leaves `project-setup.en-old.md` holding the pre-vocabulary
    // spellings without stopping the build — and what turns renaming it into a
    // build failure, which is the honest outcome.
    const badTag = tagError(relativePath, attributes.tags, vocabulary);

    if (badTag) {
      return { error: badTag };
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
    //
    // The position is written twice, once per order column: `container_order`
    // is the one every query reads, and `section_order` is written beside it,
    // unread, only because the previously deployed Worker still asks for it by
    // that name during this publication's migrate-then-deploy window (ADR
    // 0006's amendment). Dropped, and this duplication with it, once that
    // publication is confirmed live.
    const container = part
      ? `${escapeSql(part.seriesSlug)}, ${escapeSql(part.section)}, ${part.order}, ${part.order}`
      : "NULL, NULL, NULL, NULL";

    return {
      statement: `
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, series_slug, series_section, section_order, container_order, updated_at)
VALUES (${escapedSlug}, ${escapeSql(lang)}, 'post', ${title}, ${escapeSql(attributes.description)}, ${publishedAt}, ${escapeSql(attributes.repository)}, ${escapeSql(JSON.stringify(revisions.revisions))}, ${container}, CURRENT_TIMESTAMP);
`,
      key: `${slug}:${lang}`,
      tags: tagRowsFor(slug, lang, attributes.tags),
    };
  }

  // A Bookmark is a pointer; its body lives at the Source and is not yours to
  // revise. Declaring `updates` on one is a misunderstanding worth failing on
  // rather than ignoring, because ignoring it looks identical to working.
  if (attributes.updates !== undefined) {
    return { error: `${relativePath} is a Bookmark and cannot carry updates — the body is not here` };
  }

  // Checked here rather than above the branch, because a Bookmark has no draft
  // state to step around: it is a single file with no Locale, so every one of
  // them is seeded and every one of them is measured. The vocabulary covers
  // Bookmarks even though no Tag page lists them, so the day that question is
  // reopened there is nothing to clean up first.
  const badTag = tagError(relativePath, attributes.tags, vocabulary);

  if (badTag) {
    return { error: badTag };
  }

  return {
    statement: `
INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, updated_at)
VALUES (${escapedSlug}, NULL, 'link', ${title}, ${escapeSql(attributes.externalUrl)}, ${escapeSql(attributes.source)}, ${publishedAt}, CURRENT_TIMESTAMP);
`,
    key: `${slug}:`,
    tags: tagRowsFor(slug, null, attributes.tags),
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
 *
 * `content_tag` is seeded here rather than by a builder of its own, because its
 * rows are the same reading of the same files: they are inserted with the
 * Content Items and pruned with them, and the two lists cannot drift apart into
 * a Tag left alive by a Post that is gone.
 */
export function buildSeedSql(rows: ContentRow[]): string {
  const tagRows = rows.flatMap((row) => row.tags);

  const statements = rows.map((row) => row.statement).join("");
  const tagStatements = tagRows.map((row) => row.statement).join("");

  const keyList = rows.map((row) => escapeSql(row.key)).join(", ");
  const tagKeyList = tagRows.map((row) => escapeSql(row.key)).join(", ");

  // Both prunes take the same shape, empty list included: SQLite accepts an
  // empty `NOT IN ()` and reads it as matching every row, which is the right
  // answer — with nothing seeded, nothing is backed. It is why the caller, not
  // this function, guards against a walk that found no Markdown at all.
  return `${statements}${tagStatements}
DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN (${keyList});
DELETE FROM content_tag WHERE slug || ':' || ifnull(lang, '') || ':' || tag NOT IN (${tagKeyList});
`;
}
