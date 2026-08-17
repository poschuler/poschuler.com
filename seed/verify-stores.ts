import fsPromise from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import fm from "front-matter";

import { KV_PREFIXES, kvKeyFor } from "./kv/kv-keys.ts";
import { listPayloadFiles } from "./kv/payload-files.ts";
import { comparePresence, expectationFrom, type DocumentInput } from "./store-expectation.ts";

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

interface ContentTagRow {
    slug: string;
    lang: string | null;
    tag: string;
}

interface SeriesRow {
    slug: string;
    lang: string;
}

interface SeriesSectionRow {
    series_slug: string;
    lang: string;
    slug: string;
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
 * Every Markdown file under `app/content`, read but not yet classified: the
 * path relative to `CONTENT_DIR` and the raw front matter. Classifying what
 * each one is, and what it means for the stores, is `store-expectation.ts`'s
 * job — this script owns only the disk (ADR 0012).
 */
async function readContentDir(dir: string): Promise<DocumentInput[]> {
    const documents: DocumentInput[] = [];

    async function walk(current: string) {
        for (const entry of await fsPromise.readdir(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);

            if (entry.isDirectory()) {
                await walk(full);
                continue;
            }

            if (!entry.isFile() || !entry.name.endsWith(".md")) {
                continue;
            }

            const { attributes } = fm<DocumentInput["attributes"]>(
                await fsPromise.readFile(full, "utf-8"),
            );

            documents.push({ relativePath: path.relative(dir, full), attributes });
        }
    }

    await walk(dir);

    return documents;
}

function report(label: string, ok: boolean, detail: string): boolean {
    console.log(`    ${ok ? "ok  " : "FAIL"} ${label.padEnd(30)} ${detail}`);

    return ok;
}

async function verify(mode: string): Promise<boolean> {
    const wranglerArgs = mode === "remote" ? ["--remote"] : ["--local"];
    let passed = true;

    console.log(`==> D1 (${mode})`);

    // The Markdown files are the source of truth, so the expectation is
    // derived from them rather than from the generated SQL — otherwise a
    // generator that silently dropped a file would produce a seed and a
    // verification that agree with each other and with nothing else
    // (ADR 0012). Classifying what each file is happens by placement, not by
    // its front matter's `type` — `store-expectation.ts` is where that rule
    // is shared with the generators, tested, and singular.
    const documents = await readContentDir(CONTENT_DIR);
    const expected = expectationFrom(documents);

    const contentRows = d1Query<ContentRow>("select slug, lang, type from content", wranglerArgs);
    const tagRows = d1Query<ContentTagRow>("select slug, lang, tag from content_tag", wranglerArgs);
    const seriesRows = d1Query<SeriesRow>("select slug, lang from series", wranglerArgs);
    const sectionRows = d1Query<SeriesSectionRow>(
        "select series_slug, lang, slug from series_section",
        wranglerArgs,
    );

    const presenceFindings = [
        comparePresence("Content Item", expected.content,
            new Set(contentRows.map((row) => `${row.slug}:${row.lang ?? ""}`))),
        comparePresence("Tag row", expected.contentTags,
            new Set(tagRows.map((row) => `${row.slug}:${row.lang ?? ""}:${row.tag}`))),
        comparePresence("Series", expected.series,
            new Set(seriesRows.map((row) => `${row.slug}:${row.lang}`))),
        comparePresence("Series Section", expected.sections,
            new Set(sectionRows.map((row) => `${row.series_slug}:${row.lang}:${row.slug}`))),
    ];

    // The comparison itself is `store-expectation.ts`'s: this only formats the
    // findings it returns through the reporting this script already has.
    for (const finding of presenceFindings) {
        passed = report(`every ${finding.noun} present`, finding.missing.length === 0,
            finding.missing.length === 0 ? `${finding.expectedCount} rows` : `missing: ${finding.missing.join(", ")}`) && passed;
        passed = report(`no ${finding.noun} left behind`, finding.extra.length === 0,
            finding.extra.length === 0 ? "none" : `unexpected: ${finding.extra.join(", ")}`) && passed;
    }

    console.log(`==> KV (${mode})`);

    const payloads = await listPayloadFiles(PAYLOAD_DIR);
    const derivedKeys = new Set<string>();
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

        derivedKeys.add(key);

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

    // One pass per prefix this repository writes, taken from the same constant
    // `kv-bulk-upload.ts` prunes with. This used to list `blog:` alone and
    // compare its length against every payload but the sitemap — which counted
    // the Projects under `project:` and failed on a namespace that was correct
    // the moment Phase 1a added a second prefix. A hardcoded `"blog:"` was the
    // last copy of a layout `kv-keys.ts` exists to hold once.
    //
    // Names rather than counts: two wrong keys cancel out in a total, and the
    // orphan is the thing worth naming when this fails. Keys that are *missing*
    // are already reported above, one line each.
    for (const prefix of KV_PREFIXES) {
        const listed = JSON.parse(
            wrangler(["kv", "key", "list", "--binding", KV_BINDING, "--prefix", `${prefix}:`], wranglerArgs)
        ) as Array<{ name: string }>;

        const orphans = listed.map((key) => key.name).filter((name) => !derivedKeys.has(name));

        passed = report(`no orphaned ${prefix}: keys`, orphans.length === 0,
            orphans.length === 0 ? `${listed.length} keys` : `unexpected: ${orphans.join(", ")}`) && passed;
    }

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
