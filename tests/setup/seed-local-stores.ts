import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { kvKeyFor } from "../../seed/kv/kv-keys";
import { listPayloadFiles } from "../../seed/kv/payload-files";

import { TEST_PERSIST_DIR, openTestPlatform } from "./platform";

const PAYLOAD_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");

function wrangler(args: string[]): void {
  execFileSync("pnpm", ["exec", "wrangler", ...args], { stdio: "pipe" });
}

/**
 * Fills the test stores from the fixtures committed to this repo — the same
 * files CI and `scripts/smoke-test.sh` use, applied `--local`, with no network
 * and nothing near the deployed resources.
 *
 * The state directory is rebuilt from scratch on every run. Tests that write
 * (the KV prune path, anything that inserts) would otherwise leak into the next
 * run, and a suite that only passes on a dirty store is worse than no suite.
 *
 * D1 is seeded before KV because that is the order the pipeline requires, and
 * the fixtures are only consistent with each other in that order.
 */
export async function setup() {
  await fs.rm(TEST_PERSIST_DIR, { recursive: true, force: true });

  wrangler(["d1", "execute", "poschuler", "--file", "./seed/d1/schema.sql", "--local", "--persist-to", TEST_PERSIST_DIR]);
  wrangler(["d1", "execute", "poschuler", "--file", "./seed/d1/seed.sql", "--local", "--persist-to", TEST_PERSIST_DIR]);

  // Written through the binding rather than `wrangler kv bulk put`: it needs no
  // temporary manifest file and no second subprocess.
  const { env, dispose } = await openTestPlatform();

  try {
    const files = await listPayloadFiles(PAYLOAD_DIR);

    if (files.length === 0) {
      throw new Error(`No KV payloads found in ${PAYLOAD_DIR}`);
    }

    for (const file of files) {
      const key = kvKeyFor(file);

      if (!key) {
        throw new Error(`Could not derive a KV key from ${file}`);
      }

      await env.BLOG_KV.put(key, await fs.readFile(path.join(PAYLOAD_DIR, file), "utf-8"));
    }
  } finally {
    await dispose();
  }
}
