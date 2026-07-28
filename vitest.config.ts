import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Deliberately a separate file from `vite.config.ts`, and deliberately not
 * `@cloudflare/vitest-pool-workers`.
 *
 * The pool is the official way to test a Worker, but it does not survive this
 * stack: React Router in framework mode plus `@cloudflare/vite-plugin` fails
 * with `The entry point "react" cannot be marked as external`
 * (cloudflare/workers-sdk#10170, closed with "use plain Vitest" as the accepted
 * workaround). Vitest picks this file over `vite.config.ts` when both exist, so
 * the Cloudflare and React Router plugins stay out of the test run entirely.
 *
 * Real bindings still come from Miniflare — see `tests/setup/platform.ts`.
 */
export default defineConfig({
  resolve: {
    // Mirrors the `~/*` path in `tsconfig.cloudflare.json`. Without the
    // framework plugins nothing else supplies it.
    alias: { "~": path.resolve(import.meta.dirname, "app") },
  },
  test: {
    /**
     * Scoped to what the suite is meant to cover, so the number means something.
     * Measured across everything it would read as ~56%, and the missing half
     * would be React components and the resume sections — code no test here
     * claims to exercise. A coverage figure that counts work nobody signed up
     * for is a figure nobody acts on.
     *
     * What is deliberately outside this list is recorded under "Known defects"
     * in `docs/architecture.md`: the seed generators, `workers/app.ts`, and
     * every component.
     *
     * `$.tsx` is in the list and will not reach 100%: its loader and `meta` are
     * covered, its React component is not. The honest number is better than
     * excluding the file to make the total look round.
     */
    coverage: {
      provider: "v8",
      include: [
        "seed/d1/seed-sql.ts",
        "seed/kv/kv-keys.ts",
        "seed/kv/markdown.ts",
        "seed/kv/sitemap-routes.ts",
        "app/color-scheme-cookie.ts",
        "app/db.server.ts",
        "app/lib/revalidation.ts",
        "app/lib/seo/**",
        "app/models/**",
        "app/routes/$.tsx",
        "app/routes/resume-pdf/**",
        "app/routes/robots.ts",
        "app/routes/set-theme.ts",
        "app/routes/sitemap.ts",
        "workers/security-headers.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/seed-local-stores.ts"],
          /**
           * Every suite here opens its own Miniflare instance over the same
           * on-disk state. Running the files one at a time keeps two workerd
           * processes from contending for the same SQLite file.
           */
          fileParallelism: false,
          /** Booting workerd costs a few seconds on a cold run. */
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
