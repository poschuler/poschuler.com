import { createContext } from "react-router";

/**
 * The Worker environment: the bindings `wrangler types` generates from
 * `wrangler.jsonc` (KV, D1), plus the vars supplied through `.dev.vars`
 * locally and secrets in production, which Wrangler cannot infer.
 */
export type AppEnv = Env & {
  SESSION_THEME_SECRET: string;
  DB_DEBUG_FLAG: number;
  PUBLIC_HOST: string;
  DEPLOYMENT_ENV: string;
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
