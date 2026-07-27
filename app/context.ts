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
