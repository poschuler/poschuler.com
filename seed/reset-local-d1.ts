import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Rebuilds the local D1 from `seed/d1/schema.sql`.
 *
 *     node ./seed/reset-local-d1.ts
 *
 * `schema.sql` is a bare `CREATE TABLE` with no `IF NOT EXISTS`, so applying it
 * to a database that already holds the tables fails. Both callers used to
 * swallow that with `|| echo "(schema already applied)"` — which is true on a
 * developer's machine and irrelevant on a runner, and which also swallowed the
 * one case worth catching: a database that exists but is the *wrong* shape,
 * left behind by a schema change. `schema.sql` then aborts on its first
 * statement, so a table added later is never created either, and the run dies
 * two steps on inside a generator having just reported the schema was fine.
 *
 * Dropping first removes the case rather than diagnosing it. It is the
 * discipline `tests/setup/seed-local-stores.ts` already follows, for the reason
 * it gives: a check that only passes against a dirty store is worse than no
 * check. Both callers reseed immediately, and nothing in D1 is original — it is
 * a projection of the Markdown in this repository (ADR 0001).
 *
 * Only D1, and only the tables this database actually holds — read back rather
 * than listed here, so a table added to `schema.sql` needs no edit in this file
 * and cannot be left behind by one. The local KV namespace shares the same
 * state directory and is deliberately untouched: a developer who has seeded it
 * should not lose it to a fixtures check.
 */

const D1_DATABASE = "poschuler";
const SCHEMA_FILE = path.join(process.cwd(), "seed", "d1", "schema.sql");

function wrangler(args: string[]): string {
    return execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", D1_DATABASE, ...args, "--local"], {
        encoding: "utf-8",
        maxBuffer: 32 * 1024 * 1024,
    });
}

/** Objects the engines own. Dropping either is not this script's business. */
function isInternal(name: string): boolean {
    return name.startsWith("sqlite_") || name.startsWith("_cf_") || name === "d1_migrations";
}

function existingTables(): string[] {
    const output = wrangler(["--command", "select name from sqlite_master where type = 'table'", "--json"]);
    const parsed = JSON.parse(output) as Array<{ results: Array<{ name: string }> }>;

    return (parsed[0]?.results ?? []).map((row) => row.name).filter((name) => !isInternal(name));
}

const tables = existingTables();

if (tables.length > 0) {
    // Quoted, and one statement per table: a name is an identifier here, not a
    // value, so there is nothing to bind it as.
    wrangler(["--command", tables.map((name) => `drop table "${name}";`).join(" ")]);
    console.log(`==> Dropped ${tables.length} table(s) from the local D1`);
}

wrangler(["--file", SCHEMA_FILE]);

console.log("==> Local D1 rebuilt from seed/d1/schema.sql");
