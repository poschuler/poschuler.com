/**
 * Project front matter → the SQL that seeds the `project` table.
 *
 * Pure, like `seed-sql.ts`, and separate from it for the reason a Project has
 * its own table: it is not a Content Item. It has no Published At, never
 * appears in the Timeline, and is revised in place rather than published, so
 * almost none of the rules that govern a Post apply to it.
 */

import { validateRevisions } from "../../app/lib/revisions.ts";
import { treeOf } from "./content-tree.ts";
import {
  escapeSql,
  parseContentFilename,
  type ContentFileResult,
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
}

function isOneOf<T extends readonly string[]>(
  values: T,
  candidate: unknown,
): candidate is T[number] {
  return typeof candidate === "string" && (values as readonly string[]).includes(candidate);
}

/** The `INSERT OR REPLACE` for one Project, or why the build should stop. */
export function projectRowFor(
  relativePath: string,
  attributes: ProjectFrontMatter,
): ContentFileResult {
  if (treeOf(relativePath) !== "projects") {
    return { error: `${relativePath} is not in the projects tree` };
  }

  const segments = relativePath.split(/[\\/]/);
  const parsed = parseContentFilename(segments[segments.length - 1]);

  if (!parsed) {
    return { error: `could not parse slug and lang from ${relativePath}` };
  }

  const { slug, lang } = parsed;

  // No skip branch here, unlike a Post. `.en-old.md` is how a draft Post stays
  // unpublished; a Project has no drafts — it is one page, revised in place —
  // so a missing Locale is a mistake rather than an intention.
  if (!lang) {
    return { error: `${relativePath} must have a language in its filename` };
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

  const row: SeededRow = {
    statement: `
INSERT OR REPLACE INTO project (slug, lang, title, summary, description, tier, status, stack, live_url, repo_url, sort_order, updates, updated_at)
VALUES (${escapeSql(slug)}, ${escapeSql(lang)}, ${escapeSql(attributes.title)}, ${escapeSql(attributes.summary.trim())}, ${escapeSql(attributes.description)}, ${escapeSql(attributes.tier)}, ${escapeSql(attributes.status)}, ${escapeSql(JSON.stringify(attributes.stack ?? []))}, ${escapeSql(attributes.liveUrl)}, ${escapeSql(attributes.repoUrl)}, ${attributes.sortOrder ?? 0}, ${escapeSql(JSON.stringify(revisions.revisions))}, CURRENT_TIMESTAMP);
`,
    key: `${slug}:${lang}`,
  };

  return row;
}

/**
 * Inserts first, prune last, and **nothing at all** when there are no rows.
 *
 * That last part is where this differs from `buildSeedSql`. An empty `content`
 * means the walker found no Markdown, which the caller treats as a reason to
 * stop; an empty `project` is an ordinary state — Phase 1a ships the table
 * before the first Project is written — and a prune built from an empty list
 * would delete every row on the strength of finding nothing.
 */
export function buildProjectSeedSql(rows: SeededRow[]): string {
  if (rows.length === 0) {
    return "";
  }

  const statements = rows.map((row) => row.statement).join("");
  const keyList = rows.map((row) => escapeSql(row.key)).join(", ");

  return `${statements}
DELETE FROM project WHERE slug || ':' || lang NOT IN (${keyList});
`;
}
