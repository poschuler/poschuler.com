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
import {
  basenameOf,
  declaredTypeMatches,
  isMisplaced,
  localeMatchesTree,
  placementOf,
} from "./content-tree.ts";
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
  /**
   * `unknown` for the same reason as `updates`. `draftError` is what turns it
   * into a boolean or a build failure.
   */
  draft?: unknown;
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

/**
 * Where a Field Note sits in its Project — `PartPlacement`'s sibling, with no
 * section: a Project's manifest is a flat list, not an arc (Part 8 of
 * `evolution-plan/14-phase-1b-field-notes.md`). A Project accumulates because
 * the problems turn up when they turn up; a Series orders because it promised
 * a Destination.
 */
export interface NotePlacement {
  projectSlug: string;
  /** The position in the manifest's list — an index, never written by hand. */
  order: number;
}

/**
 * A Post's Container, as the manifest that holds it hands it over: a Part's
 * placement in its Series, or a Field Note's in its Project — never both, the
 * same way `content.series_slug` and `content.project_slug` never both hold a
 * value (`schema.sql`). Which one a value is is read structurally, by the
 * field only that kind carries, rather than by a `kind` tag neither manifest
 * writes.
 */
export type ContainerPlacement = PartPlacement | NotePlacement;

function isPartPlacement(container: ContainerPlacement): container is PartPlacement {
  return "seriesSlug" in container;
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
 * `post.en-old.md` therefore parses as the slug `post.en-old` with no Locale —
 * `localeMatchesTree` is what turns that into a build failure under a tree
 * that requires one, rather than the silent skip it used to be.
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
 * `draft: true` in front matter (see `evolution-plan/14-phase-1b-field-notes.md`
 * Part 3) is the whole mechanism: a file declares itself a Draft, is read,
 * classified and checked exactly like a published one, and only at the very
 * end does it produce nothing.
 *
 * JavaScript's own truthiness is not trusted for the flag. `draft` is a YAML
 * field, so `draft: 'true'` or `draft: yes` must fail the build rather than
 * being read as the boolean it merely looks like — a document silently
 * unpublished by a typo is worse than one that fails loudly.
 */
export function draftError(relativePath: string, draft: unknown): string | null {
  if (draft === undefined || typeof draft === "boolean") {
    return null;
  }

  return `${relativePath} declares draft: ${JSON.stringify(draft)} — draft must be true or false, nothing else`;
}

/** Whether a document is a Draft. `true` and nothing else counts — see `draftError`. */
export function isDraft(draft: unknown): boolean {
  return draft === true;
}

/**
 * The one switch every row builder in this file and its siblings takes, and
 * the whole of what `preview:drafts` (Part 3 of the field notes) adds to the
 * generators: with it unset or `false`, a Draft is skipped exactly as it is
 * today. Set, a Draft is read as though it were published — checked the same
 * way, emitted instead of skipped — which is what lets it render at its real
 * address without touching a tracked file.
 */
export interface DraftOptions {
  includeDrafts?: boolean;
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
 * `container` is supplied by the caller for a Post that lives inside a Series
 * or a Project, because only the manifest knows where it sits — a Part's
 * placement or a Field Note's, never both. A nested Post without one is a Part
 * or a Field Note nothing indexes, which is a failure rather than a loose
 * Post.
 *
 * `options.includeDrafts` is `preview:drafts`'s hook (see `DraftOptions`): every
 * check above the two Draft checks below still runs unconditionally, so a
 * broken draft fails the build in preview exactly as it would on publish.
 */
export function contentRowFor(
  relativePath: string,
  attributes: FrontMatterAttributes,
  vocabulary: TagVocabulary,
  container?: ContainerPlacement,
  options?: DraftOptions,
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

  // Checked once, ahead of the branch: both a Post and a Bookmark can declare
  // themselves a Draft, and a bad value is a mistake regardless of which one
  // this file is.
  const draftProblem = draftError(relativePath, attributes.draft);

  if (draftProblem) {
    return { error: draftProblem };
  }

  if (attributes.type === "post") {
    // Ahead of the Tag check, deliberately: a file whose suffix the parser
    // does not recognise — `.en-old.md`, or a mistyped `.se.md` — used to be
    // absorbed into the Slug and skipped without a word, so its Tags were
    // never measured against the vocabulary either. Now it fails here, on the
    // Locale, before anything downstream gets a chance to look at it.
    if (!localeMatchesTree(placed.tree, lang)) {
      return {
        error: `${relativePath} carries no recognised Locale — a file under ${placed.tree}/ must end in .en.md or .es.md`,
      };
    }

    const badTag = tagError(relativePath, attributes.tags, vocabulary);

    if (badTag) {
      return { error: badTag };
    }

    // Every file with a recognised Locale reaches this, drafts included: a
    // Part or a Field Note not listed in its manifest is a mistake whether or
    // not `draft: true` is set — see the check at the end of this branch for
    // the one place that flag is actually read.
    if (placed.container !== null && !container) {
      return {
        error: `${relativePath} is not listed in the ${placed.container} manifest — a Part nothing indexes cannot be reached or ordered`,
      };
    }

    const revisions = validateRevisions(attributes.updates);

    if ("error" in revisions) {
      return { error: `${relativePath}: ${revisions.error}` };
    }

    // The last check in the branch, deliberately: a Draft passes every check
    // a published document passes — its type against its placement, its Tags
    // against the vocabulary, its manifest listing, its revisions — and only
    // once all of them pass does it produce nothing, unless the caller asked
    // for Drafts to be included.
    if (isDraft(attributes.draft) && !options?.includeDrafts) {
      return { reason: `${relativePath} is a draft` };
    }

    // Written here or written as NULL, never read from front matter. The
    // three Series columns always travel together, and so do the two Project
    // ones — a Post's Container is a Part's placement or a Field Note's,
    // never both — which is why the invariant that they are all present or
    // all absent is not checked anywhere: it is not representable.
    //
    // The position is written once, into `container_order`. It was written
    // twice for one publication: `section_order` carried the same value,
    // unread, because the Worker deployed while `0006` ran still asked for it
    // by that name (ADR 0006's amendment). `0007` dropped the column once that
    // publication was live, and this duplication went with it.
    const containerColumns = !container
      ? "NULL, NULL, NULL, NULL"
      : isPartPlacement(container)
        ? `${escapeSql(container.seriesSlug)}, ${escapeSql(container.section)}, NULL, ${container.order}`
        : `NULL, NULL, ${escapeSql(container.projectSlug)}, ${container.order}`;

    return {
      statement: `
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, repository, updates, series_slug, series_section, project_slug, container_order, updated_at)
VALUES (${escapedSlug}, ${escapeSql(lang)}, 'post', ${title}, ${escapeSql(attributes.description)}, ${publishedAt}, ${escapeSql(attributes.repository)}, ${escapeSql(JSON.stringify(revisions.revisions))}, ${containerColumns}, CURRENT_TIMESTAMP);
`,
      key: `${slug}:${lang}`,
      tags: tagRowsFor(slug, lang, attributes.tags),
    };
  }

  // A Bookmark is a pointer to somebody else's document, not a Translation of
  // one, so a filename ending `.en.md` or `.es.md` is a mistake rather than a
  // value nobody reads: it would seed with `lang` set against the partial
  // unique index that assumes a Bookmark has none (Part 1 of
  // `evolution-plan/15-phase-3-spanish.md`). Ahead of every other check, the
  // same way the equivalent check leads the Post branch.
  if (!localeMatchesTree(placed.tree, lang)) {
    return {
      error: `${relativePath} is a Bookmark and its filename carries a Locale suffix ('${lang}') — a Bookmark is a pointer and has no Locale to translate`,
    };
  }

  // A Bookmark is a pointer; its body lives at the Source and is not yours to
  // revise. Declaring `updates` on one is a misunderstanding worth failing on
  // rather than ignoring, because ignoring it looks identical to working.
  if (attributes.updates !== undefined) {
    return { error: `${relativePath} is a Bookmark and cannot carry updates — the body is not here` };
  }

  // `draft: true` is the only way a Bookmark goes unpublished — see the check
  // at the end of this branch. The vocabulary covers Bookmarks even though no
  // Tag page lists them, so the day that question is reopened there is
  // nothing to clean up first.
  const badTag = tagError(relativePath, attributes.tags, vocabulary);

  if (badTag) {
    return { error: badTag };
  }

  // The last check, as on a Post: every other rule has already run.
  if (isDraft(attributes.draft) && !options?.includeDrafts) {
    return { reason: `${relativePath} is a draft` };
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
