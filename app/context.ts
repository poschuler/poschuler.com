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
