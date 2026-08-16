import { createContext } from "react-router";

/**
 * The Worker environment.
 *
 * `Env` already covers everything declared in `wrangler.jsonc` — the KV and D1
 * bindings, and the `vars` block — because `wrangler types` reads that file.
 * What it cannot see is the secrets: on a machine with `.dev.vars` it infers
 * them, and on a clean clone (CI) it does not. Declaring them here is what
 * keeps a fresh checkout type-checking.
 */
export type AppEnv = Env & {
  /** Secret. Signs the theme cookie. */
  SESSION_THEME_SECRET: string;
  /** Declared, currently unread. */
  DB_DEBUG_FLAG: string;
};

export type CloudflareContext = {
  env: AppEnv;
  ctx: ExecutionContext;
};

/**
 * The Cloudflare bindings and execution context for the current request.
 *
 * React Router v8 replaced the plain `AppLoadContext` object with typed
 * contexts, so loaders reach bindings through `context.get(cloudflareContext)`
 * rather than `context.cloudflare`. The value is set once per request in
 * `workers/app.ts`.
 */
export const cloudflareContext = createContext<CloudflareContext>();

/**
 * The per-request CSP nonce. Set in `workers/app.ts` alongside the header that
 * names it, and handed to `<ServerRouter nonce>` in `entry.server.tsx`, which
 * stamps it onto every inline script React Router emits.
 *
 * Defaults to an empty string so a missing provider degrades to "no nonce"
 * rather than throwing mid-render.
 */
export const nonceContext = createContext<string>("");

/**
 * The published Locales — today `en` and `es` (`CONTEXT.md`). A union rather
 * than `string`, so a model function that requires one turns a call site
 * missing it, or passing something else, into a compile error rather than a
 * page silently served in the wrong language.
 */
export type Locale = "en" | "es";

/**
 * The one string that marks the Spanish branch. Read both by the Worker's
 * derivation below and, later, by the route tree that mounts it (ADR 0010) —
 * declared once here so the two cannot disagree about what `/es` means.
 */
export const ES_PREFIX = "/es";

/**
 * The Locale a request's path names.
 *
 * There is no `/en/` namespace to check for: the absence of `ES_PREFIX` is
 * what English means (ADR 0010), so this is the only place that reads the
 * pathname to decide. Called once, in `workers/app.ts`, and by the test
 * platform helper that builds a loader's context the same way — everywhere
 * else reads the result off `localeContext` instead of re-deriving it.
 */
export function deriveLocale(url: URL): Locale {
  return url.pathname === ES_PREFIX || url.pathname.startsWith(`${ES_PREFIX}/`) ? "es" : "en";
}

/**
 * The per-request Locale, set once in `workers/app.ts` beside `cloudflareContext`
 * and `nonceContext` — the same place and the same shape as every other
 * per-request value. Defaults to `"en"`, the root's Locale, so a missing
 * provider degrades to the site's default branch rather than throwing
 * mid-render.
 */
export const localeContext = createContext<Locale>("en");
