import fsPromise from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import fm from "front-matter";

import { kvKeyFor } from "./kv/kv-keys.ts";
import { listPayloadFiles } from "./kv/payload-files.ts";

/**
 * Asserts that a seeded store actually holds what this repo says it should.
 *
 * The seed scripts report what they *sent*. This reads back what is *there*,
 * which is the only thing worth trusting before a deploy starts serving from
 * it: a Worker that boots perfectly still 404s every Post if KV is a key short.
 *
 *     node ./seed/verify-stores.ts local | remote
 */

const D1_DATABASE = "poschuler";
const KV_BINDING = "BLOG_KV";
const CONTENT_DIR = path.join(process.cwd(), "app", "content");
const PAYLOAD_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");

interface ContentRow {
    slug: string;
    lang: string | null;
    type: string;
}

function wrangler(args: string[], wranglerArgs: string[]): string {
    return execFileSync("pnpm", ["exec", "wrangler", ...args, ...wranglerArgs], {
        encoding: "utf-8",
        maxBuffer: 32 * 1024 * 1024,
    });
}

/**
 * wrangler wraps query results in an array of per-statement results.
 *
 * `-y` because `d1 execute --remote` prompts before touching the deployed
 * database, and there is nobody at the keyboard in CI.
 */
function d1Query<T>(sql: string, wranglerArgs: string[]): T[] {
    const confirmed = wranglerArgs.includes("--remote") ? [...wranglerArgs, "-y"] : wranglerArgs;
    const output = wrangler(["d1", "execute", D1_DATABASE, "--command", sql, "--json"], confirmed);
    const parsed = JSON.parse(output) as Array<{ results: T[] }>;

    return parsed[0]?.results ?? [];
}

/**
 * The Markdown files are the source of truth, so the expectation is derived from
 * them rather than from the generated SQL — otherwise a generator that silently
 * dropped a file would produce a seed and a verification that agree with each
 * other and with nothing else.
 *
 * The rule mirrors `generate-seed-sql.ts` exactly, including what it skips: a
 * Post whose filename carries no Locale is not seeded, so it is not expected
 * here either. `…​.en-old.md` is one such file.
 */
async function expectedContentKeys(): Promise<Set<string>> {
    const keys = new Set<string>();

    async function walk(dir: string) {
        for (const entry of await fsPromise.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await walk(full);
                continue;
            }

            if (!entry.isFile() || !entry.name.endsWith(".md")) {
                continue;
            }

            const match = entry.name.match(/^(.*?)(?:\.(en|es))?\.md$/);

            if (!match) {
                continue;
            }

            const [, slug, locale] = match;
            const { attributes } = fm<{ type?: string }>(await fsPromise.readFile(full, "utf-8"));

            if (attributes.type === "post") {
                if (locale) {
                    keys.add(`${slug}:${locale}`);
                }
            } else if (attributes.type === "link") {
                keys.add(`${slug}:`);
            }
        }
    }

    await walk(CONTENT_DIR);

    return keys;
}

function report(label: string, ok: boolean, detail: string): boolean {
    console.log(`    ${ok ? "ok  " : "FAIL"} ${label.padEnd(28)} ${detail}`);

    return ok;
}

async function verify(mode: string): Promise<boolean> {
    const wranglerArgs = mode === "remote" ? ["--remote"] : ["--local"];
    let passed = true;

    console.log(`==> D1 (${mode})`);

    const rows = d1Query<ContentRow>("select slug, lang, type from content", wranglerArgs);
    const present = new Set(rows.map((row) => `${row.slug}:${row.lang ?? ""}`));
    const expected = await expectedContentKeys();

    const missing = [...expected].filter((key) => !present.has(key));
    const extra = [...present].filter((key) => !expected.has(key));

    passed = report("every Content Item present", missing.length === 0,
        missing.length === 0 ? `${expected.size} rows` : `missing: ${missing.join(", ")}`) && passed;
    passed = report("no rows left behind", extra.length === 0,
        extra.length === 0 ? "none" : `unexpected: ${extra.join(", ")}`) && passed;

    console.log(`==> KV (${mode})`);

    const payloads = await listPayloadFiles(PAYLOAD_DIR);
    let identical = 0;

    for (const filename of payloads) {
        // Derived, not rebuilt. This used to reimplement the key layout inline,
        // which made it the third copy of a rule `kv-keys.ts` exists to hold
        // once — and this script's whole job is to catch keys that disagree.
        const key = kvKeyFor(filename);

        if (!key) {
            passed = report(filename, false, "no key could be derived from this payload") && passed;
            continue;
        }

        const local = await fsPromise.readFile(path.join(PAYLOAD_DIR, filename), "utf-8");
        let stored = "";

        try {
            stored = wrangler(["kv", "key", "get", "--binding", KV_BINDING, key], wranglerArgs);
        } catch {
            passed = report(key, false, "the read failed") && passed;
            continue;
        }

        // A missing key is not an error to `kv key get`: it prints "Value not
        // found" and exits 0. Parsing has to carry the check, or the one case
        // this whole script exists for slips through as a crash.
        let storedDocument: unknown;

        try {
            storedDocument = JSON.parse(stored);
        } catch {
            const detail = stored.trim() === "Value not found"
                ? "missing from the namespace"
                : "stored value is not JSON";

            passed = report(key, false, detail) && passed;
            continue;
        }

        // Compared as parsed JSON, not as text: what matters is that the Worker
        // reads back the same document, and `kv key get` need not preserve the
        // file's whitespace.
        if (JSON.stringify(storedDocument) === JSON.stringify(JSON.parse(local))) {
            identical++;
        } else {
            passed = report(key, false, "stored value differs from the payload") && passed;
        }
    }

    passed = report("payloads byte-identical", identical === payloads.length,
        `${identical}/${payloads.length}`) && passed;

    const listed = JSON.parse(
        wrangler(["kv", "key", "list", "--binding", KV_BINDING, "--prefix", "blog:"], wranglerArgs)
    ) as Array<{ name: string }>;

    const expectedKeys = payloads.filter((file) => file !== "sitemap.json").length;

    passed = report("no orphaned blog: keys", listed.length === expectedKeys,
        `${listed.length} keys, ${expectedKeys} expected`) && passed;

    return passed;
}

const modeArg = process.argv[2];

if (modeArg !== "local" && modeArg !== "remote") {
    console.error("ERROR: pass a mode: 'local' or 'remote'.");
    process.exit(1);
}

verify(modeArg)
    .then((passed) => {
        console.log(passed ? `\n${modeArg} stores verified.` : `\nVerification failed.`);
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
