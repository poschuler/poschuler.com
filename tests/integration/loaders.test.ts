import fs from "node:fs/promises";
import path from "node:path";

import type { LoaderFunctionArgs } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loader as robotsLoader } from "~/routes/robots";
import { action as setThemeAction } from "~/routes/set-theme";
import { loader as sitemapLoader } from "~/routes/sitemap";

import {
  openTestPlatform,
  platformWith,
  routeArgs,
  type TestPlatform,
} from "../setup/platform";

/**
 * The resource routes, invoked with the same context `workers/app.ts` builds and
 * reading the same D1 and KV the deployed Worker reads.
 *
 * This is the layer `scripts/smoke-test.sh` cannot reach: it tells a 200 from a
 * 500, but "a route that returns 200 and the wrong content passes" is exactly
 * the gap `docs/architecture.md` records. These assert the content.
 */

let platform: TestPlatform;
let postSlug: string;

/** Derived rather than hardcoded — a Slug never changes, but which Posts exist does. */
async function firstPublishedSlug(): Promise<string> {
  const payloads = await fs.readdir(path.join(process.cwd(), "seed", "kv", "kv_payloads", "blog"));
  const [first] = payloads.filter((file) => file.endsWith(".en.json")).sort();

  return first.replace(/\.en\.json$/, "");
}

beforeAll(async () => {
  platform = await openTestPlatform();
  postSlug = await firstPublishedSlug();
});

afterAll(async () => {
  await platform?.dispose();
});

type Args = LoaderFunctionArgs;

const get = (url: string) => new Request(url);

const post = (scheme: string, headers: HeadersInit = {}) =>
  new Request("https://poschuler.com/set-theme", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ "color-scheme": scheme }),
  });

describe("/sitemap.xml", () => {
  it("serves the pre-generated XML from KV", async () => {
    const response = await sitemapLoader(
      routeArgs<Args>(platform, get("https://poschuler.com/sitemap.xml")),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/xml");

    const body = await response.text();

    expect(body).toContain("<urlset");
    expect(body).toContain(postSlug);
  });

  it("caches publicly for an hour — the body is the same for everyone", async () => {
    const response = await sitemapLoader(
      routeArgs<Args>(platform, get("https://poschuler.com/sitemap.xml")),
    );

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("404s when the key is missing rather than serving an empty document", async () => {
    const missing = platformWith(platform, { BLOG_KV: { get: async () => null } });

    await expect(
      sitemapLoader(routeArgs<Args>(missing, get("https://poschuler.com/sitemap.xml"))),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("/robots.txt", () => {
  it("names the configured canonical origin", async () => {
    const configured = platformWith(platform, { PUBLIC_HOST: "https://poschuler.com" });

    const response = await robotsLoader(
      routeArgs<Args>(configured, get("https://preview.example.com/robots.txt")),
    );

    expect(await response.text()).toContain("Sitemap: https://poschuler.com/sitemap.xml");
  });

  /**
   * `PUBLIC_HOST` used to be required, and throwing on its absence made this
   * route answer 500 on every request — invisibly, because Cloudflare's managed
   * robots.txt filled the gap and looked like a working answer.
   */
  it("falls back to the request's own origin when PUBLIC_HOST is unset", async () => {
    const unset = platformWith(platform, { PUBLIC_HOST: undefined });

    const response = await robotsLoader(
      routeArgs<Args>(unset, get("https://preview.example.com/robots.txt")),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Sitemap: https://preview.example.com/sitemap.xml");
  });

  it("ignores a malformed PUBLIC_HOST instead of taking the route down", async () => {
    const malformed = platformWith(platform, { PUBLIC_HOST: "poschuler.com" });

    const response = await robotsLoader(
      routeArgs<Args>(malformed, get("https://preview.example.com/robots.txt")),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Sitemap: https://preview.example.com/sitemap.xml");
  });

  it("advertises the site as indexable", async () => {
    const response = await robotsLoader(
      routeArgs<Args>(platform, get("https://poschuler.com/robots.txt")),
    );
    const body = await response.text();

    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
  });
});

describe("/set-theme", () => {
  /**
   * The signing secret is supplied here rather than taken from the ambient
   * `env`. On a developer's machine `.dev.vars` would provide it and CI has
   * none — which is the exact shape of the bug that took the site down: code
   * that only worked where someone happened to have the value configured.
   */
  const configured = () => platformWith(platform, { SESSION_THEME_SECRET: "a-test-secret" });

  it("writes the cookie and redirects back to where the toggle was clicked", async () => {
    const response = await setThemeAction(
      routeArgs<Args>(configured(), post("dark", { Referer: "https://poschuler.com/blog?page=2" })),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/blog?page=2");
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-poschuler-color-scheme=/);
  });

  /**
   * `Referer` is attacker-influenceable, so following it blindly is an open
   * redirect. Only same-origin destinations are honoured.
   */
  it("refuses to redirect off-origin", async () => {
    const response = await setThemeAction(
      routeArgs<Args>(configured(), post("dark", { Referer: "https://evil.example.com/phish" })),
    );

    expect(response.headers.get("Location")).toBe("/");
  });

  it("redirects home when there is no Referer at all", async () => {
    const response = await setThemeAction(routeArgs<Args>(configured(), post("dark")));

    expect(response.headers.get("Location")).toBe("/");
  });

  it("redirects home when the Referer is not a URL", async () => {
    const response = await setThemeAction(
      routeArgs<Args>(configured(), post("dark", { Referer: "not a url" })),
    );

    expect(response.headers.get("Location")).toBe("/");
  });

  it("coerces a value outside the schema to system rather than failing", async () => {
    const response = await setThemeAction(routeArgs<Args>(configured(), post("neon")));

    expect(response.status).toBe(302);
    expect(response.headers.get("Set-Cookie")).toBeTruthy();
  });

  /**
   * The outage, from the inside: without the signing secret this endpoint
   * throws, and that failure must stay here. `scripts/smoke-test.sh` asserts the
   * other half — that the rest of the site keeps serving.
   */
  it("throws when the signing secret is missing", async () => {
    const unconfigured = platformWith(platform, { SESSION_THEME_SECRET: undefined });

    await expect(
      setThemeAction(routeArgs<Args>(unconfigured, post("dark"))),
    ).rejects.toThrow("SESSION_THEME_SECRET");
  });
});
