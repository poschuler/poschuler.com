/**
 * The whole D1 access layer: one function.
 *
 * The site never writes — content reaches D1 through the seed pipeline, not
 * through a request — so `dbExecute` and `dbQueryRow` were removed along with
 * the rest of the unreachable code. Add them back the day a route needs them.
 */

/**
 * Runs `sql` against `db` and returns its rows.
 *
 * `values` are bound, never interpolated. Errors are logged with the statement
 * that produced them — Workers observability keeps the log, and an error
 * without its query is close to useless — and then rethrown untouched, so the
 * route's ErrorBoundary still sees the original failure.
 */
export async function dbQuery<T extends Record<string, unknown>>(
    db: D1Database,
    sql: string,
    values: unknown[] = []
): Promise<T[]> {
    try {
        const result = await db.prepare(sql).bind(...values).all<T>();

        return result.results ?? [];
    } catch (error) {
        console.error("D1 dbQuery failed", { sql, error });
        throw error;
    }
}
