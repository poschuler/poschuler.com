import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kvKeyFor } from "../../../seed/kv/kv-keys";

/**
 * The upload script and the test setup both derive keys with this. A key layout
 * with two implementations has two chances to drift, and a drifted key is a
 * published Post that 404s.
 */

describe("kvKeyFor", () => {
  it("maps a Post payload to blog:<slug>:<locale>", () => {
    expect(kvKeyFor("value-objects.en.json")).toBe("blog:value-objects:en");
  });

  /** The Slug is everything before the last dot, so a dotted Slug survives. */
  it("keeps the dots inside a Slug", () => {
    expect(kvKeyFor("a.dotted.slug.es.json")).toBe("blog:a.dotted.slug:es");
  });

  it("gives the sitemap a key of its own", () => {
    expect(kvKeyFor("sitemap.json")).toBe("sitemap");
  });

  it("returns null for a name it cannot split", () => {
    expect(kvKeyFor("nolocale.json")).toBeNull();
  });

  /**
   * Reads the payloads actually committed. A key derived here that does not
   * match what the route asks KV for is a 404 nobody sees until a visitor does.
   */
  it("derives a key for every committed payload", async () => {
    const dir = path.join(process.cwd(), "seed", "kv", "kv_payloads");
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(kvKeyFor(file), `${file} produced no key`).toBeTruthy();
    }
  });

  /** `/blog/:blogSlug` reads `blog:<slug>:en`; these are the keys it will find. */
  it("produces keys in the shape the Post route looks up", async () => {
    const dir = path.join(process.cwd(), "seed", "kv", "kv_payloads");
    const files = (await fs.readdir(dir)).filter(
      (file) => file.endsWith(".json") && file !== "sitemap.json",
    );

    for (const file of files) {
      expect(kvKeyFor(file)).toMatch(/^blog:[^:]+:(en|es)$/);
    }
  });
});
