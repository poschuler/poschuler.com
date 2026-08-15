import fs from "node:fs";
import fsPromise from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { KV_PREFIXES, kvKeyFor } from "./kv-keys.ts";
import { listPayloadFiles } from "./payload-files.ts";

/**
 * Uploads the generated KV payloads, locally or to the deployed namespace.
 *
 * Two rules, both of which this script used to break, and both of which matter
 * because it now runs unattended in CI against production:
 *
 * 1. **Write before deleting.** It used to delete every `blog:` key and then
 *    upload them back one at a time, which left the published Posts returning
 *    404 for as long as the upload took. Keys are written first — a `put` over
 *    an existing key is a replacement — and only then is anything removed.
 * 2. **Fail loudly.** Every upload used to sit in a `try/catch` that logged and
 *    carried on, so the script printed success and exited 0 having uploaded
 *    nothing. A failed write now ends the run non-zero.
 */

const KV_BINDING = "BLOG_KV";
const JSON_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");

function wrangler(args: string[], wranglerArgs: string[]): string {
    return execFileSync("pnpm", ["exec", "wrangler", ...args, ...wranglerArgs], {
        encoding: "utf-8",
    });
}

async function bulkUpload(mode: string) {
    const wranglerArgs = mode === "remote" ? ["--remote"] : ["--local"];

    console.log(`Starting ${mode.toUpperCase()} upload to KV binding: ${KV_BINDING}`);

    if (!fs.existsSync(JSON_DIR)) {
        throw new Error(`ERROR: Directory ${JSON_DIR} does not exist. Run 'pnpm run kv:generate' first.`);
    }

    const files = await listPayloadFiles(JSON_DIR);
    const entries: Array<{ key: string; value: string }> = [];

    for (const relativePath of files) {
        const key = kvKeyFor(relativePath);

        if (!key) {
            throw new Error(`ERROR: could not derive a KV key from ${relativePath}.`);
        }

        entries.push({
            key,
            value: await fsPromise.readFile(path.join(JSON_DIR, relativePath), "utf-8"),
        });
    }

    if (entries.length === 0) {
        throw new Error(`ERROR: no payloads found in ${JSON_DIR}.`);
    }

    // One request rather than one per key: less time spent half-written, and the
    // whole batch fails together.
    const manifest = path.join(await fsPromise.mkdtemp(path.join(os.tmpdir(), "kv-")), "bulk.json");
    await fsPromise.writeFile(manifest, JSON.stringify(entries), "utf-8");

    console.log(`Uploading ${entries.length} keys...`);
    wrangler(["kv", "bulk", "put", manifest, "--binding", KV_BINDING], wranglerArgs);

    for (const { key } of entries) {
        console.log(`   -> ✅ ${key}`);
    }

    await pruneOrphans(entries.map((entry) => entry.key), wranglerArgs);

    console.log(`✅ ${entries.length} payloads uploaded to KV (${mode.toUpperCase()}).`);
}

/**
 * Removes keys with no payload behind them any more — a Post or a Project
 * deleted or renamed. Scoped to the prefixes this repository writes, so nothing
 * else in the namespace is this script's business. The sitemap is deliberately
 * outside them: it is rewritten every run and never orphaned.
 */
async function pruneOrphans(expected: string[], wranglerArgs: string[]) {
    const keys = KV_PREFIXES.flatMap((prefix) => {
        const listed = wrangler(
            ["kv", "key", "list", "--binding", KV_BINDING, "--prefix", `${prefix}:`],
            wranglerArgs,
        );
        return JSON.parse(listed) as Array<{ name: string }>;
    });

    const orphans = keys.map((key) => key.name).filter((name) => !expected.includes(name));

    if (orphans.length === 0) {
        return;
    }

    console.log(`🧹 Removing ${orphans.length} key(s) no longer backed by a payload...`);

    for (const orphan of orphans) {
        wrangler(["kv", "key", "delete", "--binding", KV_BINDING, orphan], wranglerArgs);
        console.log(`   -> 🗑️  ${orphan}`);
    }
}

const modeArg = process.argv[2];

if (modeArg !== "local" && modeArg !== "remote") {
    console.error("ERROR: pass a mode: 'local' or 'remote'.");
    process.exit(1);
}

bulkUpload(modeArg).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
