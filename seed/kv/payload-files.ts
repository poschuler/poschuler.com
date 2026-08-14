import fs from "node:fs/promises";
import path from "node:path";

/**
 * Every generated payload, as a path relative to `kv_payloads/`.
 *
 * Four places need this list — the upload script, the store verifier, the test
 * setup and the key test — and each one used to hold its own `readdir`. That
 * was harmless while the directory was flat; now that a payload's directory
 * decides its key prefix, a listing that forgets to recurse silently uploads
 * nothing rather than failing.
 *
 * Sorted, because `readdir` order is whatever the filesystem hands back and the
 * upload manifest is built from it.
 */
export async function listPayloadFiles(payloadDir: string): Promise<string[]> {
  const entries = await fs.readdir(payloadDir, { withFileTypes: true, recursive: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.relative(payloadDir, path.join(entry.parentPath, entry.name)))
    .sort();
}
