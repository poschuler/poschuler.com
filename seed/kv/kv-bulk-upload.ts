import fsPromise from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const KV_BINDING = "BLOG_KV";
const JSON_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");

async function bulkUpload(mode: string) {
    let WRANGLER_ARGS = "--local"
    //const WRANGLER_ARGS = mode === "local" ? "--local" : "";
    if (mode === "remote") WRANGLER_ARGS = "--remote"
    //const isRemote = mode === "remote";

    console.log(`Starting ${mode.toUpperCase()} bulk upload to KV binding: ${KV_BINDING}`);

    if (!fs.existsSync(JSON_DIR)) {
        throw new Error(`ERROR: Directory ${JSON_DIR} does not exist. Run 'npm run kv:generate' first.`);
    }

    await clearKv(mode, WRANGLER_ARGS);

    const files = await fsPromise.readdir(JSON_DIR);

    for (const filename of files.filter(f => f.endsWith('.json') && f !== 'sitemap.json')) {

        const base_filename = filename.replace('.json', '');
        const parts = base_filename.split('.');

        const key_lang = parts.pop();
        const key_slug = parts.join('.');

        if (!key_slug || !key_lang) {
            console.log(` -> ❌ SKIPPING: Could not parse slug/lang from ${filename}.`);
            continue;
        }

        const kv_key = `blog:${key_slug}:${key_lang}`;
        const filePath = path.join(JSON_DIR, filename);

        console.log(`Uploading ${kv_key} from ${filename}...`);

        try {
            const command = `npx wrangler kv key put --binding ${KV_BINDING} "${kv_key}" --path "${filePath}" ${WRANGLER_ARGS} `;

            console.log(command);

            execSync(command, { stdio: 'inherit' });

        } catch (e) {
            console.error(` -> ❌ FAILED to upload ${kv_key}.`);
            console.log((e as Error).message);
        }
    }

    for (const filename of files.filter(f => f === 'sitemap.json')) {

        const kv_key = `sitemap`;
        const filePath = path.join(JSON_DIR, filename);

        console.log(`Uploading ${kv_key} from ${filename}...`);

        try {
            const command = `npx wrangler kv key put --binding ${KV_BINDING} "${kv_key}" --path "${filePath}" ${WRANGLER_ARGS} `;

            console.log(command);

            execSync(command, { stdio: 'inherit' });

        } catch (e) {
            console.error(` -> ❌ FAILED to upload ${kv_key}.`);
            console.log((e as Error).message);
        }
    }



    console.log(`✅ All JSON payloads successfully uploaded to KV (${mode.toUpperCase()}).`);
}

const modeArg = process.argv[2];
if (modeArg !== 'local' && modeArg !== 'remote') {
    console.log("ERROR: Debe especificar el modo: 'local' o 'remote' como argumento.");
    process.exit(1);
}

async function clearKv(mode: string, wranglerArgs: string) {
    console.log(`🧹 Cleaning up existing 'blog:' keys in KV...`);

    try {
        // List keys with the prefix 'blog:'
        const listCommand = `npx wrangler kv key list --binding ${KV_BINDING} --prefix "blog:" ${wranglerArgs}`;
        const output = execSync(listCommand, { encoding: 'utf-8' });
        const keys = JSON.parse(output) as { name: string }[];

        if (keys.length === 0) {
            console.log("No existing blog keys found. Skipping cleanup.");
            return;
        }

        console.log(`Found ${keys.length} keys to delete...`);

        for (const key of keys) {
            const deleteCmd = `npx wrangler kv key delete --binding ${KV_BINDING} "${key.name}" ${wranglerArgs}`;
            execSync(deleteCmd, { stdio: 'ignore' }); // ignore stdio to keep logs clean
        }

        console.log("✅ Cleanup complete.");
    } catch (e) {
        console.warn("⚠️ Cleanup failed or no keys found. Continuing with upload.");
    }
}

bulkUpload(modeArg).catch(e => {
    console.error(e);
    process.exit(1);
});