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
/**
 * The `__Host-` prefix is not decoration: browsers refuse a cookie carrying it
 * unless it is `Secure`, has `Path=/` and has **no** `Domain`. That last one is
 * the point.
 *
 * The predecessor, `poschuler__color-scheme`, was emitted host-only while
 * `DEPLOYMENT_ENV` was unset in production and gained `Domain=poschuler.com`
 * the day that var was finally deployed. A browser treats those as two separate
 * cookies of the same name, sends both, and whoever parses reads whichever
 * arrives first — so every returning visitor had their theme frozen at the old
 * value while each click wrote the new one somewhere it would never be read.
 *
 * Quitting `domain` would have fixed that instance by relying on the browser
 * ordering same-path cookies oldest-first. This forbids the whole class
 * instead: nobody can reintroduce a second scope, because the browser would
 * reject the cookie outright rather than quietly shadowing the first.
 *
 * Renaming also settles the existing duplicates — nothing holds this name yet —
 * at the cost of resetting everyone's preference once. The other cost is that
 * `Secure` is now unconditional: `localhost` counts as a secure origin, so dev
 * and preview are fine, but reaching a dev server over plain http on a LAN
 * address will not persist a theme.
 */
function colorSchemeCookie(env: AppEnv) {
  if (!env.SESSION_THEME_SECRET) {
    throw new Error("Missing env: SESSION_THEME_SECRET");
  }

  const cookie = createCookie("__Host-poschuler-color-scheme", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: true,
    maxAge: 30 * 24 * 60 * 60,
    secrets: [env.SESSION_THEME_SECRET],
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
