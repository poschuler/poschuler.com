import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { KV_PREFIXES, kvKeyFor } from "../../../seed/kv/kv-keys";

/**
 * The upload script and the test setup both derive keys with this. A key layout
 * with two implementations has two chances to drift, and a drifted key is a
 * published Post that 404s.
 */

const PAYLOAD_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");

/** Every payload, as a path relative to `kv_payloads/`. */
async function committedPayloads(): Promise<string[]> {
  const entries = await fs.readdir(PAYLOAD_DIR, { withFileTypes: true, recursive: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.relative(PAYLOAD_DIR, path.join(entry.parentPath, entry.name)));
}

describe("kvKeyFor", () => {
  it("maps a Post payload to blog:<slug>:<locale>", () => {
    expect(kvKeyFor("blog/value-objects.en.json")).toBe("blog:value-objects:en");
  });

  /** The directory decides the prefix, exactly as it decides a content file's kind. */
  it("maps a Project payload to project:<slug>:<locale>", () => {
    expect(kvKeyFor("projects/chekalo.en.json")).toBe("project:chekalo:en");
  });

  /** The Slug is everything before the last dot, so a dotted Slug survives. */
  it("keeps the dots inside a Slug", () => {
    expect(kvKeyFor("blog/a.dotted.slug.es.json")).toBe("blog:a.dotted.slug:es");
  });

  it("gives the sitemap a key of its own", () => {
    expect(kvKeyFor("sitemap.json")).toBe("sitemap");
  });

  it("reads a Windows-style path the same way", () => {
    expect(kvKeyFor("blog\\value-objects.en.json")).toBe("blog:value-objects:en");
  });

  it.each([
    ["blog/nolocale.json", "a name it cannot split"],
    ["drafts/x.en.json", "a directory with no prefix"],
    ["x.en.json", "a payload loose at the root"],
    ["blog/nested/x.en.json", "a path nested deeper than the layout allows"],
  ])("returns null for %s — %s", (relativePath) => {
    expect(kvKeyFor(relativePath)).toBeNull();
  });

  /**
   * Reads the payloads actually committed. A key derived here that does not
   * match what the route asks KV for is a 404 nobody sees until a visitor does.
   */
  it("derives a key for every committed payload", async () => {
    const payloads = await committedPayloads();

    expect(payloads.length).toBeGreaterThan(0);

    for (const payload of payloads) {
      expect(kvKeyFor(payload), `${payload} produced no key`).toBeTruthy();
    }
  });

  /** These are the keys the Post and Project routes will look up. */
  it("produces keys in the shape the routes look up", async () => {
    const payloads = (await committedPayloads()).filter((file) => file !== "sitemap.json");

    for (const payload of payloads) {
      expect(kvKeyFor(payload)).toMatch(
        new RegExp(`^(${KV_PREFIXES.join("|")}):[^:]+:(en|es)$`),
      );
    }
  });
});
