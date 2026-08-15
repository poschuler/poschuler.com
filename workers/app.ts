import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext, nonceContext, type AppEnv } from "../app/context";
import { resolveRedirect } from "../app/lib/redirects";
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
    // Before the router, because a URL that no longer exists has no route to
    // match and no loader to run. The table and the matching live in
    // `app/lib/redirects.ts`, which is where they can be tested — this module
    // depends on a virtual build the test runner cannot resolve.
    //
    // 301, which transfers the authority the old address earned. A 302 tells
    // the engine to keep the old one indexed and move nothing.
    const destination = resolveRedirect(new URL(request.url));

    if (destination) {
      return new Response(null, { status: 301, headers: { Location: destination } });
    }

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
