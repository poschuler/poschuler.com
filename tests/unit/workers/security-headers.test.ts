import { describe, expect, it } from "vitest";

import {
  contentSecurityPolicy,
  SECURITY_HEADERS,
  STRICT_TRANSPORT_SECURITY,
  withSecurityHeaders,
} from "../../../workers/security-headers";

/**
 * The headers every response leaves with. Two things make this worth testing
 * rather than reading: the CSP is only exercised in a production build, so dev
 * never shows a mistake in it; and the rebuild-don't-mutate rule exists because
 * a proxied response throws on `.set`.
 */

const html = (init: ResponseInit = {}) =>
  new Response("<!doctype html><p>hi</p>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    ...init,
  });

const production = { nonce: "n0nce", isProduction: true };
const development = { nonce: "n0nce", isProduction: false };

describe("the headers that apply everywhere", () => {
  it.each(Object.entries(SECURITY_HEADERS))("sets %s in production", (name, value) => {
    expect(withSecurityHeaders(html(), production).headers.get(name)).toBe(value);
  });

  it.each(Object.entries(SECURITY_HEADERS))("sets %s in development too", (name, value) => {
    expect(withSecurityHeaders(html(), development).headers.get(name)).toBe(value);
  });

  it("refuses framing and sniffing outright", () => {
    const headers = withSecurityHeaders(html(), production).headers;

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps the headers the response already carried", () => {
    const response = new Response("x", {
      headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
    });

    const result = withSecurityHeaders(response, production);

    expect(result.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(result.headers.get("Content-Type")).toBe("text/plain");
  });

  it("preserves the status and status text", () => {
    const response = new Response("nope", { status: 404, statusText: "Not Found" });

    const result = withSecurityHeaders(response, production);

    expect(result.status).toBe(404);
    expect(result.statusText).toBe("Not Found");
  });

  it("passes the body through", async () => {
    const result = withSecurityHeaders(html(), production);

    expect(await result.text()).toContain("<p>hi</p>");
  });

  /**
   * A response proxied from `fetch` — the Resume PDF — carries immutable
   * headers, and `.set` on those throws. Returning a new Response is what keeps
   * `/resume.pdf` from 500ing.
   */
  it("returns a new Response instead of mutating the one it was given", () => {
    const original = html();
    const result = withSecurityHeaders(original, production);

    expect(result).not.toBe(original);
    expect(original.headers.get("X-Frame-Options")).toBeNull();
  });
});

describe("the Content Security Policy", () => {
  it("is attached to HTML in production", () => {
    const csp = withSecurityHeaders(html(), production).headers.get("Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
  });

  /** Vite injects its own inline scripts, which carry no nonce and would be blocked. */
  it("is absent in development", () => {
    expect(
      withSecurityHeaders(html(), development).headers.get("Content-Security-Policy"),
    ).toBeNull();
  });

  /** A nonce on a cached asset would be a nonce shared between visitors. */
  it.each([
    ["a stylesheet", "text/css"],
    ["a PDF", "application/pdf"],
    ["plain text", "text/plain"],
  ])("is not attached to %s", (_name, contentType) => {
    const response = new Response("x", { headers: { "Content-Type": contentType } });

    expect(
      withSecurityHeaders(response, production).headers.get("Content-Security-Policy"),
    ).toBeNull();
  });

  it("is not attached to a response with no Content-Type at all", () => {
    const response = new Response(null, { status: 204 });

    expect(
      withSecurityHeaders(response, production).headers.get("Content-Security-Policy"),
    ).toBeNull();
  });

  it("carries the nonce it was handed", () => {
    const csp = withSecurityHeaders(html(), { nonce: "abc123", isProduction: true }).headers.get(
      "Content-Security-Policy",
    );

    expect(csp).toContain("'nonce-abc123'");
  });

  it("uses a different nonce for a different request", () => {
    const first = withSecurityHeaders(html(), { nonce: "first", isProduction: true });
    const second = withSecurityHeaders(html(), { nonce: "second", isProduction: true });

    expect(first.headers.get("Content-Security-Policy")).not.toBe(
      second.headers.get("Content-Security-Policy"),
    );
  });

  /**
   * `style-src` keeps `'unsafe-inline'` because Base UI positions popups with
   * inline `style` attributes. Scripts must not: they carry the nonce, and
   * `'unsafe-inline'` alongside a nonce makes the nonce decorative.
   */
  it("allows inline styles but never inline scripts", () => {
    const csp = contentSecurityPolicy("n0nce");
    const directive = (name: string) =>
      csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

    expect(directive("style-src")).toContain("'unsafe-inline'");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
  });

  it("locks down the directives with no legitimate source", () => {
    const csp = contentSecurityPolicy("n0nce");

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  /** The allow-list mirrors what the site actually loads, and nothing else. */
  it.each([
    ["the GitHub avatar", "https://avatars.githubusercontent.com"],
    ["Google Fonts stylesheets", "https://fonts.googleapis.com"],
    ["Google Fonts files", "https://fonts.gstatic.com"],
    ["the Cloudflare Insights beacon", "https://static.cloudflareinsights.com"],
  ])("allows %s", (_name, origin) => {
    expect(contentSecurityPolicy("n0nce")).toContain(origin);
  });

  it("falls back to 'self' for everything else", () => {
    expect(contentSecurityPolicy("n0nce")).toContain("default-src 'self'");
  });
});

describe("Strict-Transport-Security", () => {
  it("is set in production, for a year, including subdomains", () => {
    expect(withSecurityHeaders(html(), production).headers.get("Strict-Transport-Security")).toBe(
      STRICT_TRANSPORT_SECURITY,
    );
    expect(STRICT_TRANSPORT_SECURITY).toContain("max-age=31536000");
  });

  /** Pinning a dev machine to HTTPS for a year would be a hard mistake to undo. */
  it("is absent in development", () => {
    expect(
      withSecurityHeaders(html(), development).headers.get("Strict-Transport-Security"),
    ).toBeNull();
  });

  /** Unlike the CSP, it is not about the body — every response gets it. */
  it("applies to non-HTML responses too", () => {
    const pdf = new Response("%PDF", { headers: { "Content-Type": "application/pdf" } });

    expect(withSecurityHeaders(pdf, production).headers.get("Strict-Transport-Security")).toBe(
      STRICT_TRANSPORT_SECURITY,
    );
  });
});
