import { createCookie } from "react-router";
import { createTypedCookie } from "remix-utils/typed-cookie";
import { z } from "zod";
import type { AppEnv } from "~/context";

// Create a Zod schema to validate the cookie value
export const schema = z
  .enum(["dark", "light", "system"]) // Possible color schemes
  .default("system") // If no cookie, default to "system"
  .catch("system"); // In case of an error, default to "system"

export type ColorScheme = z.infer<typeof schema>;

/**
 * Built per request, from the request-scoped `env` — never at module scope.
 *
 * An earlier version read `process.env` while the module was being evaluated
 * and threw on a missing value. That turned a missing var into a Worker that
 * threw on *every* request, taking the whole site down to protect a theme
 * preference. Bindings are request-scoped here; read them that way.
 */
function colorSchemeCookie(env: AppEnv) {
  if (!env.SESSION_THEME_SECRET) {
    throw new Error("Missing env: SESSION_THEME_SECRET");
  }

  const isProduction = env.DEPLOYMENT_ENV === "production";

  const cookie = createCookie("poschuler__color-scheme", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    secrets: [env.SESSION_THEME_SECRET],
    ...(isProduction ? { domain: "poschuler.com", secure: true } : {}),
  });

  return createTypedCookie({ cookie, schema });
}

/**
 * Reading degrades: a misconfigured Worker still serves every page, in the
 * default theme, and says so in the logs. Writing does not — see below.
 */
export async function getColorScheme(
  request: Request,
  env: AppEnv
): Promise<ColorScheme> {
  try {
    const colorScheme = await colorSchemeCookie(env).parse(
      request.headers.get("Cookie")
    );

    return colorScheme ?? "system";
  } catch (error) {
    console.error("Could not read the colour scheme cookie", error);
    return "system";
  }
}

/**
 * Writing throws on a missing secret rather than falling back. A cookie signed
 * with a placeholder is worse than a toggle that visibly fails: the failure is
 * confined to this one endpoint, and the rest of the site is unaffected.
 */
export async function setColorScheme(colorScheme: ColorScheme, env: AppEnv) {
  return await colorSchemeCookie(env).serialize(colorScheme);
}
