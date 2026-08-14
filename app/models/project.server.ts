import { dbQuery } from "~/db.server";

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

export type ProjectRowType = {
  idProject: number;
  slug: string;
  lang: string;
  title: string;
  /** Outcome-first, one or two sentences. What the index shows. */
  summary: string;
  description: string | null;
  tier: ProjectTier;
  status: "active" | "archived";
  /** A JSON array as stored, parsed by the route that renders it. */
  stack: string;
  liveUrl: string | null;
  repoUrl: string | null;
  /** A JSON array as stored — `parseRevisions` in `app/lib/revisions.ts`. */
  updates: string;
};

/**
 * Every Project, heaviest first.
 *
 * Ordered by `sort_order` rather than by any date, because recency is the wrong
 * signal for a portfolio: the strongest evidence is not the newest. `tier` is
 * not in the ordering — it groups the rendering, and mixing the two would make
 * a tier change silently reorder the page.
 */
export function findAllProjects(db: D1Database) {
  return dbQuery<ProjectRowType>(
    db,
    `select ${PROJECT_COLUMNS}
      from project
      order by sort_order asc, slug asc
    `,
  );
}

/**
 * One Project by Slug, in a Locale.
 *
 * Returns `null` rather than throwing: a Slug that does not exist is a 404 the
 * route decides on, not a database error.
 */
export async function findProjectBySlug(db: D1Database, slug: string, lang = "en") {
  const rows = await dbQuery<ProjectRowType>(
    db,
    `select ${PROJECT_COLUMNS}
      from project
      where slug = ? and lang = ?
      limit 1
    `,
    [slug, lang],
  );

  return rows[0] ?? null;
}
