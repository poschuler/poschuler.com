import fsPromise from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Asserts that the deployed D1 has the shape `seed/d1/schema.sql` describes.
 *
 * There is no migration tool here, on purpose — see ADR 0002. The schema is
 * applied by hand, which means a commit that changes the table's shape can
 * reach production with the deployed table still on the old one. The seed and
 * the deploy both succeed; the site reads a column that is not there. This does
 * not fix that, and it does not apply anything: it refuses to let the run
 * continue, before a single row or key is written.
 *
 *     node ./seed/verify-schema.ts
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

/**
 * Objects the engines create for themselves. `_cf_KV` is Cloudflare's own and
 * exists in every deployed D1 and in no local one; `sqlite_sequence` follows
 * `AUTOINCREMENT` around. Leaving either in the comparison would fail every run
 * forever, for a difference nothing in this repo controls.
 */
function isInternal(name: string): boolean {
    return name.startsWith("sqlite_") || name.startsWith("_cf_");
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

/** Reindentation is not a schema change; a renamed column is. */
function normalise(sql: string): string {
    return sql.replace(/\s+/g, " ").trim();
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
            tables.set(object.name, describeColumns(object.name, wranglerArgs));
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

function compare(kind: string, expected: Map<string, string>, actual: Map<string, string>): boolean {
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
        console.log(`         declared: ${expected.get(name)}`);
        console.log(`         deployed: ${actual.get(name)}`);
    }

    return passed;
}

async function verify(): Promise<boolean> {
    console.log("==> Building the expectation from seed/d1/schema.sql");

    await fsPromise.rm(SCRATCH_STATE, { recursive: true, force: true });

    const scratch = ["--local", "--persist-to", SCRATCH_STATE];

    wrangler(["d1", "execute", D1_DATABASE, "--file", SCHEMA_FILE], scratch);

    const expected = readShape(scratch);

    console.log("==> Reading the deployed schema");

    const actual = readShape(["--remote"]);

    console.log("==> Tables");
    const tablesOk = compare("table", expected.tables, actual.tables);

    console.log("==> Indexes");
    const indexesOk = compare("index", expected.indexes, actual.indexes);

    return tablesOk && indexesOk;
}

verify()
    .then((passed) => {
        if (passed) {
            console.log("\nThe deployed schema matches seed/d1/schema.sql.");
            process.exit(0);
        }

        console.log("\nThe deployed schema has drifted from seed/d1/schema.sql.");
        console.log("Apply the difference by hand before this can seed — there is no migration tool.");
        process.exit(1);
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
