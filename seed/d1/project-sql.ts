/**
 * Project front matter → the SQL that seeds the `project` table, and the
 * position of every Field Note it lists.
 *
 * Pure, like `seed-sql.ts`, and separate from it for the reason a Project has
 * its own table: it is not a Content Item. It has no Published At, never
 * appears in the Timeline, and is revised in place rather than published, so
 * almost none of the rules that govern a Post apply to it.
 *
 * The manifest is authorship; D1 is a projection of it (ADR 0001). What the
 * manifest declares that nothing else could is which notes the Project holds
 * and in what order — a flat list, not an arc (Part 8 of
 * `evolution-plan/14-phase-1b-field-notes.md`): a Series orders because it
 * promised a Destination, a Project accumulates because the problems turn up
 * when they turn up.
 */

import { validateRevisions } from "../../app/lib/revisions.ts";
import { basenameOf, treeOf } from "./content-tree.ts";
import { containerContradictionError, reconcileManifest } from "./manifest.ts";
import {
  draftError,
  escapeSql,
  isDraft,
  parseContentFilename,
  type InvalidFile,
  type NotePlacement,
  type SeededRow,
} from "./seed-sql.ts";

/** Weight, never route shape — promoting a project never moves its URL. */
const TIERS = ["flagship", "supporting", "experiment"] as const;
const STATUSES = ["active", "archived"] as const;

export type ProjectTier = (typeof TIERS)[number];
export type ProjectStatus = (typeof STATUSES)[number];

export interface ProjectFrontMatter {
  type: "project";
  title: string;
  summary: string;
  description?: string;
  tier: ProjectTier;
  status: ProjectStatus;
  stack?: string[];
  liveUrl?: string;
  repoUrl?: string;
  sortOrder?: number;
  /** `unknown` for the same reason as on a Post: this is a YAML field. */
  updates?: unknown;
  /**
   * The Field Notes this Project holds, in the order the index renders them —
   * curated, not chronological (Part 8). Absent means none yet, which is the
   * state every Project shipped in before 1b.
   */
  notes?: unknown;
  /** `unknown` for the same reason as `updates` — see `draftError`. */
  draft?: unknown;
}

/** A Markdown file found under a Project folder, already parsed. */
export interface ProjectNoteFile {
  /** The Slug, from the filename. */
  slug: string;
  lang: string;
  /** The folder it sits in — its own name, per the rule in `content-tree.ts`. */
  folder: string;
  relativePath: string;
  /**
   * Whether this note's own front matter declares `draft: true`. Read
   * leniently here — the definitive check that the value is a boolean at all
   * happens where the note's own row is built, in `contentRowFor` — because
   * all this needs is to tell a published note from an unpublished one for
   * the Container-contradiction check below.
   */
  draft: boolean;
}

export interface ProjectRows {
  slug: string;
  lang: string;
  /** Keyed `slug:lang`. */
  project: SeededRow;
  /** Note Slug → where the manifest says it sits. */
  notes: Map<string, NotePlacement>;
  /**
   * Whether this manifest declared itself a Draft. `project` above is still
   * built when it did — the caller decides whether to seed it — because
   * `notes` is needed either way: a drafted Container's notes, which must
   * themselves be Drafts (see the Container-contradiction check), still have
   * to be listed and reconciled like any other.
   */
  draft: boolean;
}

export type ProjectResult = ProjectRows | InvalidFile;

export function isInvalidProject(result: ProjectResult): result is InvalidFile {
  return "error" in result;
}

function isOneOf<T extends readonly string[]>(
  values: T,
  candidate: unknown,
): candidate is T[number] {
  return typeof candidate === "string" && (values as readonly string[]).includes(candidate);
}

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * `notes:` must be a list of Slugs when it is declared at all — absent means
 * none yet, which is a Project's ordinary state before its first note.
 */
function notesFrontMatterError(relativePath: string, notes: unknown): string | null {
  if (notes === undefined) {
    return null;
  }

  if (!Array.isArray(notes)) {
    return `${relativePath} declares notes that is not a list — expected an ordered list of Slugs`;
  }

  for (const slug of notes) {
    if (!isFilledString(slug)) {
      return `${relativePath} lists an empty Field Note`;
    }
  }

  return null;
}

/**
 * The rows for one Project manifest, or the reason the build should stop.
 *
 * `noteFiles` is every Markdown file under this Project folder that carries
 * this manifest's Locale and a recognised one at all — the same convention
 * `seriesRowsFor` reads `partFiles` under.
 */
export function projectRowFor(
  relativePath: string,
  attributes: ProjectFrontMatter,
  noteFiles: ProjectNoteFile[],
): ProjectResult {
  if (treeOf(relativePath) !== "projects") {
    return { error: `${relativePath} is not in the projects tree` };
  }

  const parsed = parseContentFilename(basenameOf(relativePath));

  if (!parsed) {
    return { error: `could not parse slug and lang from ${relativePath}` };
  }

  const { slug, lang } = parsed;

  // A Project has no `.en-old.md` convention to hide behind — it is one page,
  // revised in place, and a filename with no Locale is a mistake rather than
  // an intention. `draft: true` is the only way one goes unpublished, checked
  // below, after every other rule has run.
  if (!lang) {
    return { error: `${relativePath} must have a language in its filename` };
  }

  const draftProblem = draftError(relativePath, attributes.draft);

  if (draftProblem) {
    return { error: draftProblem };
  }

  if (!isOneOf(TIERS, attributes.tier)) {
    return { error: `${relativePath} has tier '${attributes.tier}' — expected one of ${TIERS.join(", ")}` };
  }

  if (!isOneOf(STATUSES, attributes.status)) {
    return { error: `${relativePath} has status '${attributes.status}' — expected one of ${STATUSES.join(", ")}` };
  }

  if (typeof attributes.summary !== "string" || attributes.summary.trim() === "") {
    return { error: `${relativePath} has no summary — the index has nothing to show` };
  }

  const revisions = validateRevisions(attributes.updates);

  if ("error" in revisions) {
    return { error: `${relativePath}: ${revisions.error}` };
  }

  // A Project has no Published At, so its most recent revision is the only date
  // it has and the sitemap has nothing else to date it by. Requiring one entry
  // — "First published." — is cheaper than a second date field that means the
  // same thing and can disagree with this one.
  if (revisions.revisions.length === 0) {
    return {
      error: `${relativePath} declares no updates — a Project needs at least one, the day its page went up`,
    };
  }

  const notesProblem = notesFrontMatterError(relativePath, attributes.notes);

  if (notesProblem) {
    return { error: notesProblem };
  }

  const noteSlugs = (attributes.notes ?? []) as string[];

  // Every entry from this manifest carries the same `where` — the manifest
  // has no sections to blame a duplicate on — so a slug listed twice always
  // reads as "listed twice" rather than "in both 'a' and 'b'".
  const entries = noteSlugs.map((noteSlug) => ({ slug: noteSlug, where: relativePath }));
  const reconcile = reconcileManifest(relativePath, entries, noteFiles, "Field Note");

  if (reconcile) {
    return { error: reconcile };
  }

  if (isDraft(attributes.draft)) {
    const contradiction = containerContradictionError(relativePath, noteFiles);

    if (contradiction) {
      return { error: contradiction };
    }
  }

  const project: SeededRow = {
    statement: `
INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES (${escapeSql(slug)}, ${escapeSql(lang)}, ${escapeSql(attributes.title)}, ${escapeSql(attributes.summary.trim())}, ${escapeSql(attributes.description)}, ${escapeSql(attributes.tier)}, ${escapeSql(attributes.status)}, ${escapeSql(JSON.stringify(attributes.stack ?? []))}, ${escapeSql(attributes.liveUrl)}, ${escapeSql(attributes.repoUrl)}, ${attributes.sortOrder ?? 0}, ${escapeSql(JSON.stringify(revisions.revisions))}, CURRENT_TIMESTAMP);
`,
    key: `${slug}:${lang}`,
  };

  const notes = new Map<string, NotePlacement>();

  noteSlugs.forEach((noteSlug, index) => {
    notes.set(noteSlug, { projectSlug: slug, order: index });
  });

  return { slug, lang, project, notes, draft: isDraft(attributes.draft) };
}

/**
 * Inserts first, prune last, and nothing at all when there are no Projects —
 * unless `anyFilesFound` says otherwise.
 *
 * That last part is where this differs from `buildSeedSql`. An empty `project`
 * with nothing found on disk is an ordinary state — the table exists before
 * the first Project is written — and a prune built from that silence would
 * delete every row on the strength of finding nothing.
 *
 * But zero rows is no longer only that state: every Project this walk found
 * may have declared `draft: true`, in which case something *was* found and a
 * previously published Project must still be pruned. The caller is the only
 * one who knows which case this is — `rows.length` alone cannot say — so it
 * passes `anyFilesFound` for the files it walked, drafts included.
 */
export function buildProjectSeedSql(
  rows: SeededRow[],
  { anyFilesFound = false }: { anyFilesFound?: boolean } = {},
): string {
  if (rows.length === 0 && !anyFilesFound) {
    return "";
  }

  const statements = rows.map((row) => row.statement).join("");
  const keyList = rows.map((row) => escapeSql(row.key)).join(", ");

  return `${statements}
DELETE FROM project WHERE slug || ':' || lang NOT IN (${keyList});
`;
}
