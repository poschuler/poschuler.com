import fsPromise from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Asserts that something has the shape `seed/d1/schema.sql` describes.
 *
 *     node ./seed/verify-schema.ts local | remote
 *
 * `schema.sql` is the declared shape, and every database that does not exist
 * yet is built from it directly. The deployed one is the exception: it already
 * exists, so it is moved forward by the migrations in `seed/d1/migrations/`
 * instead. See ADR 0006. Two things therefore need proving, and the modes are
 * one each:
 *
 * - `local` — the migration chain, applied from zero, arrives at exactly the
 *   declared shape. The shape is written twice, once as a whole and once as a
 *   path, and this is what makes that safe. No credentials, so it runs in the
 *   `verify` job on every push, before production has seen anything.
 * - `remote` — the deployed database is the declared shape. It runs first in
 *   the publication job, after the migrations have been applied and before a
 *   single row or key is written. It confirms; it no longer blocks a run for a
 *   step somebody forgot, because there is no longer a step to forget.
 *
 * The expectation is built by applying `schema.sql` to a throwaway local
 * database rather than by parsing it, so there is no second, hand-written
 * description of the schema to drift from the first — and SQLite normalises
 * both sides for us.
 *
 * That last part is load-bearing. Comparing the two databases' stored DDL as
 * text does not work: `wrangler d1 export --no-data` returns the `content`
 * table with its comments intact from the deployed database and with them
 * stripped from a local one, because the two were created through different
 * paths. So columns are compared through `pragma_table_info`, which reports the
 * shape rather than the wording. Indexes have to stay as text — a partial
 * index's `WHERE` clause is not exposed by any pragma, and it is the whole
 * reason `INSERT OR REPLACE` behaves as an upsert here.
 */

const D1_DATABASE = "poschuler";
const SCHEMA_FILE = path.join(process.cwd(), "seed", "d1", "schema.sql");

/**
 * Its own state directory, wiped first: `schema.sql` is a bare `CREATE TABLE`
 * with no `IF NOT EXISTS`, so it only applies cleanly to an empty database, and
 * borrowing the one `wrangler --local` and the smoke test share would both fail
 * here and disturb what a developer has seeded.
 */
const SCRATCH_STATE = path.join(process.cwd(), ".wrangler", "state-schema-check");

/** A second one, for the chain, and wiped for the same reason. */
const SCRATCH_CHAIN = path.join(process.cwd(), ".wrangler", "state-schema-chain");

/**
 * Objects the engines create for themselves. `_cf_KV` is Cloudflare's own and
 * exists in every deployed D1 and in no local one; `sqlite_sequence` follows
 * `AUTOINCREMENT` around; `d1_migrations` is wrangler's record of which
 * migrations have run. Leaving any of them in the comparison would fail every
 * run forever, for a difference nothing in this repo declares.
 */
function isInternal(name: string): boolean {
    return name.startsWith("sqlite_") || name.startsWith("_cf_") || name === "d1_migrations";
}

interface SchemaObject {
    type: string;
    name: string;
    sql: string | null;
}

interface Column {
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
}

/** The shape of one database, as the two things worth comparing. */
interface Shape {
    /** Table name → its columns, rendered as one comparable line. */
    tables: Map<string, string>;
    /** Index name → its `CREATE INDEX`, whitespace-normalised. */
    indexes: Map<string, string>;
}

function wrangler(args: string[], wranglerArgs: string[]): string {
    return execFileSync("pnpm", ["exec", "wrangler", ...args, ...wranglerArgs], {
        encoding: "utf-8",
        maxBuffer: 32 * 1024 * 1024,
    });
}

/**
 * `-y` because `d1 execute --remote` prompts before touching the deployed
 * database, and there is nobody at the keyboard in CI. Reading is all this
 * script ever does, but the prompt does not know that.
 */
function d1Query<T>(sql: string, wranglerArgs: string[]): T[] {
    const confirmed = wranglerArgs.includes("--remote") ? [...wranglerArgs, "-y"] : wranglerArgs;
    const output = wrangler(["d1", "execute", D1_DATABASE, "--command", sql, "--json"], confirmed);
    const parsed = JSON.parse(output) as Array<{ results: T[] }>;

    return parsed[0]?.results ?? [];
}

/**
 * Reindentation is not a schema change; a renamed column is.
 *
 * `IF NOT EXISTS` goes with the whitespace, and it has to: SQLite stores an
 * index's `CREATE` verbatim, so the baseline migration's guarded statements
 * would otherwise read as different indexes from the bare ones in `schema.sql`
 * and fail the chain against the very file it was copied from. It is a
 * statement form, not a shape.
 */
function normalise(sql: string): string {
    return sql
        .replace(/\s+/g, " ")
        .replace(/ IF NOT EXISTS /i, " ")
        .trim();
}

/**
 * The named table constraints, as sorted `name(expression)` pairs.
 *
 * `pragma_table_info` reports columns and nothing else, so a `CHECK` is
 * invisible to the comparison — and this schema keeps in `CHECK`s the rules a
 * column type cannot express: which `tier` values exist, which `status` values,
 * and that a Post must carry a Locale. A migration that recreated a table
 * without them, or with a different value list, would otherwise read as
 * identical, and the gate that makes writing the shape twice safe would pass
 * on a database the repository does not describe.
 *
 * Parsed out of the stored `CREATE TABLE`, because SQLite exposes no pragma for
 * them, and the whole statement still cannot be compared as text: SQLite keeps
 * a deployed table's comments and drops them from one that has been rewritten
 * by `ALTER`, and the column order differs for the same reason.
 *
 * Parentheses are counted rather than matched with a pattern, because
 * `CHECK (tier IN ('a', 'b'))` nests. A paren inside a string literal would
 * fool the count — and would fool it identically on both sides, which is all
 * this has to be: deterministic, not a SQL parser.
 */
function checkConstraints(sql: string): string {
    const constraints: string[] = [];
    const opening = /CONSTRAINT\s+(\w+)\s+CHECK\s*\(/gi;
    let match: RegExpExecArray | null;

    while ((match = opening.exec(sql)) !== null) {
        let depth = 1;
        let index = opening.lastIndex;

        while (index < sql.length && depth > 0) {
            if (sql[index] === "(") {
                depth++;
            } else if (sql[index] === ")") {
                depth--;
            }

            index++;
        }

        constraints.push(`${match[1]}(${normalise(sql.slice(opening.lastIndex, index - 1))})`);
    }

    return constraints.sort().join(" | ");
}

function describeColumns(table: string, wranglerArgs: string[]): string {
    const columns = d1Query<Column>(
        `select name, type, "notnull", dflt_value, pk from pragma_table_info('${table}') order by name`,
        wranglerArgs,
    );

    return columns
        .map((column) =>
            [column.name, column.type, column.notnull, column.dflt_value ?? "", column.pk].join(" "),
        )
        .join(" | ");
}

function readShape(wranglerArgs: string[]): Shape {
    const objects = d1Query<SchemaObject>(
        "select type, name, sql from sqlite_master order by type, name",
        wranglerArgs,
    ).filter((object) => !isInternal(object.name));

    const tables = new Map<string, string>();
    const indexes = new Map<string, string>();

    for (const object of objects) {
        if (object.type === "table") {
            const columns = describeColumns(object.name, wranglerArgs);
            const constraints = checkConstraints(object.sql ?? "");

            tables.set(object.name, constraints ? `${columns} || ${constraints}` : columns);
        } else if (object.type === "index" && object.sql) {
            // A `sql` of null is an index SQLite made itself to back a UNIQUE
            // constraint. It is a consequence of the table's shape, which is
            // already compared, not a thing this repo declares.
            indexes.set(object.name, normalise(object.sql));
        }
    }

    return { tables, indexes };
}

function report(label: string, ok: boolean, detail: string): boolean {
    console.log(`    ${ok ? "ok  " : "FAIL"} ${label.padEnd(28)} ${detail}`);

    return ok;
}

function compare(
    kind: string,
    expected: Map<string, string>,
    actual: Map<string, string>,
    actualLabel: string,
): boolean {
    const missing = [...expected.keys()].filter((name) => !actual.has(name));
    const extra = [...actual.keys()].filter((name) => !expected.has(name));
    const differing = [...expected.keys()].filter(
        (name) => actual.has(name) && actual.get(name) !== expected.get(name),
    );

    let passed = true;

    passed = report(`every ${kind} present`, missing.length === 0,
        missing.length === 0 ? `${expected.size} declared` : `missing: ${missing.join(", ")}`) && passed;

    passed = report(`no undeclared ${kind}`, extra.length === 0,
        extra.length === 0 ? "none" : `unexpected: ${extra.join(", ")}`) && passed;

    passed = report(`every ${kind} matches`, differing.length === 0,
        differing.length === 0 ? "identical" : `differs: ${differing.join(", ")}`) && passed;

    for (const name of differing) {
        console.log(`         declared:      ${expected.get(name)}`);
        console.log(`         ${actualLabel.padEnd(14)} ${actual.get(name)}`);
    }

    return passed;
}

/** What each mode compares the declared shape against. */
const SUBJECTS = {
    local: { heading: "Applying seed/d1/migrations from zero", label: "chain:", noun: "migration chain" },
    remote: { heading: "Reading the deployed schema", label: "deployed:", noun: "deployed schema" },
} as const;

type Mode = keyof typeof SUBJECTS;

async function verify(mode: Mode): Promise<boolean> {
    console.log("==> Building the expectation from seed/d1/schema.sql");

    await fsPromise.rm(SCRATCH_STATE, { recursive: true, force: true });

    const scratch = ["--local", "--persist-to", SCRATCH_STATE];

    wrangler(["d1", "execute", D1_DATABASE, "--file", SCHEMA_FILE], scratch);

    const expected = readShape(scratch);

    console.log(`==> ${SUBJECTS[mode].heading}`);

    let actual: Shape;

    if (mode === "remote") {
        actual = readShape(["--remote"]);
    } else {
        await fsPromise.rm(SCRATCH_CHAIN, { recursive: true, force: true });

        const chain = ["--local", "--persist-to", SCRATCH_CHAIN];

        wrangler(["d1", "migrations", "apply", D1_DATABASE], chain);

        actual = readShape(chain);
    }

    console.log("==> Tables");
    const tablesOk = compare("table", expected.tables, actual.tables, SUBJECTS[mode].label);

    console.log("==> Indexes");
    const indexesOk = compare("index", expected.indexes, actual.indexes, SUBJECTS[mode].label);

    return tablesOk && indexesOk;
}

const modeArg = process.argv[2];

function isMode(value: string | undefined): value is Mode {
    return value === "local" || value === "remote";
}

if (!isMode(modeArg)) {
    console.error("ERROR: pass a mode: 'local' or 'remote'.");
    process.exit(1);
}

const { noun } = SUBJECTS[modeArg];

verify(modeArg)
    .then((passed) => {
        if (passed) {
            console.log(`\nThe ${noun} matches seed/d1/schema.sql.`);
            process.exit(0);
        }

        console.log(`\nThe ${noun} has drifted from seed/d1/schema.sql.`);
        console.log(
            modeArg === "local"
                ? "A migration and the declared shape disagree. Fix them before this reaches production."
                : "Nothing was written. Correct it with a migration — see ADR 0006 — and publish again.",
        );
        process.exit(1);
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
