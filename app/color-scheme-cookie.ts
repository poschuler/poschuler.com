import { createCookie } from "react-router";
import { createTypedCookie } from "remix-utils/typed-cookie";
import { z } from "zod";

/**
 * The one place that reads `process.env` instead of the request-scoped
 * `cloudflareContext`: `createCookie` runs at module scope, before any request
 * exists. `wrangler types` declares these on `NodeJS.ProcessEnv`, and the
 * runtime populates them from vars and secrets.
 *
 * Missing values throw at startup rather than defaulting. A signing secret that
 * silently falls back is worse than a Worker that refuses to boot: the site
 * keeps working while every cookie is signed with a value anyone can read.
 */
function requireEnv(name: "SESSION_THEME_SECRET" | "DEPLOYMENT_ENV"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

const isProduction = requireEnv("DEPLOYMENT_ENV") === "production";

// Create a cookie using React Router's createCookie API
const cookie = createCookie("poschuler__color-scheme", {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  maxAge: 30 * 24 * 60 * 60,
  secrets: [requireEnv("SESSION_THEME_SECRET")],
  ...(isProduction ? { domain: "poschuler.com", secure: true } : {}),
});

// Create a Zod schema to validate the cookie value
export const schema = z
  .enum(["dark", "light", "system"]) // Possible color schemes
  .default("system") // If no cookie, default to "system"
  .catch("system"); // In case of an error, default to "system"

export type ColorScheme = z.infer<typeof schema>;

// Use Remix Utils to ensure the cookie value is always parsed
const typedCookie = createTypedCookie({ cookie, schema });

// Helpers to get and set the cookie
export async function getColorScheme(request: Request): Promise<ColorScheme> {
  const colorScheme = await typedCookie.parse(request.headers.get("Cookie"));
  return colorScheme ?? "system";
}

export async function setColorScheme(colorScheme: ColorScheme) {
  return await typedCookie.serialize(colorScheme);
}
