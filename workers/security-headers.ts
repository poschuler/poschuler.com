/**
 * The response headers every request leaves with.
 *
 * Split out of `app.ts` because that module imports
 * `virtual:react-router/server-build`, which only exists under the React Router
 * Vite plugin and therefore cannot be imported from a test. The policy is the
 * part worth asserting; the module that owns the fetch handler is not.
 */

/** Cheap to add, and none of them depend on the response body. */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";

/**
 * The allow-list mirrors what the site actually loads: the Cloudflare Insights
 * beacon, and nothing else off-origin. Everything else falls back to `'self'`.
 *
 * `img-src` no longer names `avatars.githubusercontent.com`: the portrait and
 * the Open Graph card are both served from this origin now, so the only thing
 * that host could still authorise is an image nobody asked for.
 *
 * It does name `raw.githubusercontent.com`, under `/poschuler/` and no wider.
 * A Post's diagrams are generated in the repository they describe and belong
 * there, not copied into this one — a decision about where an artefact lives,
 * which is why the host is authorised rather than the files vendored. The path
 * keeps it to repositories that are actually mine; a source expression whose
 * path ends in `/` matches by prefix.
 *
 * Two things come with it, both accepted rather than overlooked. GitHub serves
 * raw files with `max-age=300`, so a diagram is a third-party round trip every
 * five minutes instead of an edge asset. And the URLs name `refs/heads/main`,
 * so a published Post follows that repository's default branch: regenerate a
 * diagram there and the Post changes with no revision entry behind it. Pinning
 * a commit in the URL is what closes the second one, if it ever matters enough.
 *
 * `style-src` and `font-src` no longer name `fonts.googleapis.com` and
 * `fonts.gstatic.com`. Inter and Intel One Mono are self-hosted from
 * `app/app.css`, so a third party can no longer inject a stylesheet or
 * a font into this document, and the render path no longer depends on a host
 * this site does not control.
 *
 * `style-src` keeps `'unsafe-inline'` because Base UI positions popups with
 * inline `style` attributes. Scripts do not need it — they carry the nonce.
 *
 * The Cloudflare Insights beacon is embedded by hand in `root.tsx`, not by
 * Cloudflare's automatic injection: this Worker generates the response
 * itself, with no origin fetch for the edge to rewrite, so automatic
 * injection never sees the HTML to modify. A manually-embedded beacon reports
 * to `cloudflareinsights.com`, not to this domain's own `/cdn-cgi/rum` the
 * way an automatically-injected one would — hence that host in `connect-src`.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https://raw.githubusercontent.com/poschuler/",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com`,
    "connect-src 'self' https://cloudflareinsights.com",
  ].join("; ");
}

export type SecurityHeaderOptions = {
  nonce: string;
  /**
   * Dev is exempt from CSP and HSTS: Vite injects its own inline scripts, which
   * carry no nonce and would be blocked. That also means **the policy is only
   * exercised in a production build** — verify changes with `pnpm run preview`,
   * not `pnpm run dev`.
   */
  isProduction: boolean;
};

/**
 * Returns a new Response carrying the security headers.
 *
 * Rebuilt rather than mutated, and that is not a style choice: a response
 * proxied from `fetch` — the Resume PDF — carries immutable headers, and `.set`
 * on those throws.
 *
 * The CSP is attached only to HTML. A stylesheet or a PDF has no scripts to
 * govern, and a nonce on a cached asset would be a nonce shared between
 * visitors.
 */
export function withSecurityHeaders(
  response: Response,
  { nonce, isProduction }: SecurityHeaderOptions,
): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  if (isProduction) {
    if (headers.get("Content-Type")?.includes("text/html")) {
      headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
    }

    headers.set("Strict-Transport-Security", STRICT_TRANSPORT_SECURITY);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
