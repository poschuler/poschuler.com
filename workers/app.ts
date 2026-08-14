import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext, nonceContext, type AppEnv } from "../app/context";
import { withSecurityHeaders } from "./security-headers";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

/**
 * The only entry point. Builds the per-request context, runs the handler, and
 * hands the response to `security-headers.ts` — which owns the policy and is
 * tested there, because this module cannot be imported outside the Vite plugin
 * that supplies `virtual:react-router/server-build`.
 */
export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();

    // Per request, and handed to `<ServerRouter nonce>` in `entry.server.tsx`,
    // which stamps it onto every inline script React Router emits.
    //
    // Production only, and that is not an optimisation: dev is exempt from CSP
    // (see `security-headers.ts`), so a nonce there would be stamped onto
    // markup no policy will ever check — while React, whose client render
    // carries no nonce at all, reports the difference as a hydration mismatch.
    const nonce = import.meta.env.PROD ? crypto.randomUUID() : "";

    context.set(cloudflareContext, { env, ctx });
    context.set(nonceContext, nonce);

    const response = await requestHandler(request, context);

    return withSecurityHeaders(response, {
      nonce,
      isProduction: import.meta.env.PROD,
    });
  },
} satisfies ExportedHandler<AppEnv>;
