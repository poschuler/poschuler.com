import { createRequestHandler } from "react-router";

declare global {
  interface CloudflareEnvironment extends Env { }
}

type Env = {
  SESSION_THEME_SECRET: string;
  DB_DEBUG_FLAG: number;
  PUBLIC_HOST: string;
  DEPLOYMENT_ENV: string;
  POSCHULER_BD: D1Database;
  BLOG_KV: KVNamespace;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
