import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext, nonceContext, type AppEnv } from "../app/context";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

/** Cheap to add, and none of them depend on the response body. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * The allow-list mirrors what the site actually loads: Google Fonts, the GitHub
 * avatar, and the Cloudflare Insights beacon. Everything else falls back to
 * `'self'`.
 *
 * `style-src` keeps `'unsafe-inline'` because Base UI positions popups with
 * inline `style` attributes. Scripts do not need it — they carry the nonce.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com`,
    "connect-src 'self' https://cloudflareinsights.com",
  ].join("; ");
}

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    const nonce = crypto.randomUUID();

    context.set(cloudflareContext, { env, ctx });
    context.set(nonceContext, nonce);

    const response = await requestHandler(request, context);

    // Rebuilt rather than mutated: a response proxied from `fetch` (the Resume
    // PDF) carries immutable headers, and `.set` on those throws.
    const headers = new Headers(response.headers);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    // Dev is exempt from CSP: Vite injects its own inline scripts, which carry
    // no nonce and would be blocked.
    if (import.meta.env.PROD) {
      if (headers.get("Content-Type")?.includes("text/html")) {
        headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
      }

      headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<AppEnv>;
