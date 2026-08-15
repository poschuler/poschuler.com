import { dbQuery } from "~/db.server";
import { parseRevisions, type Revision } from "~/lib/revisions";

/**
 * The columns every Project query returns, aliased snake_case → camelCase in
 * SQL so the mapping lives next to the query rather than in JavaScript — the
 * same shape `content.server.ts` uses.
 *
 * This is a fixed fragment, not a value: nothing user-supplied is ever
 * interpolated into a statement. Values still go through `.bind()`.
 */
const PROJECT_COLUMNS = `
      id_project as "idProject",
      slug as "slug",
      lang as "lang",
      title as "title",
      summary as "summary",
      description as "description",
      tier as "tier",
      status as "status",
      stack as "stack",
      live_url as "liveUrl",
      repo_url as "repoUrl",
      updates as "updates"`;

/** Weight, never route shape — see ADR 0004's sibling decision in the schema. */
export type ProjectTier = "flagship" | "supporting" | "experiment";

/** A row as the column layout stores it: `stack` and `updates` unparsed JSON. */
type StoredProjectRow = {
  idProject: number;
  slug: string;
  lang: string;
  title: string;
  /** Outcome-first, one or two sentences. What the index shows. */
  summary: string;
  description: string | null;
  tier: ProjectTier;
  status: "active" | "archived";
  stack: string;
  liveUrl: string | null;
  repoUrl: string | null;
  updates: string;
};

/**
 * A Project as the routes receive it, with the JSON columns already read.
 *
 * Parsed here rather than in a component: `docs/design.md` puts that mapping in
 * the model, next to the query that knows the column is JSON in the first place.
 */
export type ProjectRowType = Omit<StoredProjectRow, "stack" | "updates"> & {
  stack: string[];
  revisions: Revision[];
};

/** A stored JSON array, or an empty one — a column is not worth a 500. */
function parseStack(stored: string): string[] {
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function hydrate(row: StoredProjectRow): ProjectRowType {
  const { stack, updates, ...rest } = row;

  return { ...rest, stack: parseStack(stack), revisions: parseRevisions(updates) };
}

/**
 * Every Project, heaviest first.
 *
 * Ordered by `sort_order` rather than by any date, because recency is the wrong
 * signal for a portfolio: the strongest evidence is not the newest. `tier` is
 * not in the ordering — it groups the rendering, and mixing the two would make
 * a tier change silently reorder the page.
 */
export async function findAllProjects(db: D1Database) {
  const rows = await dbQuery<StoredProjectRow>(
    db,
    `select ${PROJECT_COLUMNS}
      from project
      order by sort_order asc, slug asc
    `,
  );

  return rows.map(hydrate);
}

/**
 * One Project by Slug, in a Locale.
 *
 * Returns `null` rather than throwing: a Slug that does not exist is a 404 the
 * route decides on, not a database error.
 */
export async function findProjectBySlug(db: D1Database, slug: string, lang = "en") {
  const rows = await dbQuery<StoredProjectRow>(
    db,
    `select ${PROJECT_COLUMNS}
      from project
      where slug = ? and lang = ?
      limit 1
    `,
    [slug, lang],
  );

  return rows[0] ? hydrate(rows[0]) : null;
}
