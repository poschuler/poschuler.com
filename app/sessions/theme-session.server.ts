import { createThemeSessionResolver } from "remix-themes";
import { createCookieSessionStorage } from "react-router";

interface ENV {
  SESSION_THEME_SECRET: string;
  DEPLOYMENT_ENV: string | undefined;
}

let themeResolver: ReturnType<typeof createThemeResolverFactory> | null = null;

export function createThemeResolverFactory({ SESSION_THEME_SECRET, DEPLOYMENT_ENV }: ENV) {

  const isProduction = DEPLOYMENT_ENV === "production";

  if (typeof SESSION_THEME_SECRET !== "string" || SESSION_THEME_SECRET === "") {
    throw new Error("Missing env: SESSION_THEME_SECRET");
  }

  const themeSessionStorage = createCookieSessionStorage({
    cookie: {
      name: "poschuler__theme",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      secrets: [SESSION_THEME_SECRET],
      ...(isProduction ? { domain: "poschuler.com", secure: true } : {}),
    },
  });

  return createThemeSessionResolver(themeSessionStorage);
}

export function getThemeResolver(env: ENV) {
  if (themeResolver === null) {
    themeResolver = createThemeResolverFactory(
      {
        SESSION_THEME_SECRET: env.SESSION_THEME_SECRET,
        DEPLOYMENT_ENV: env.DEPLOYMENT_ENV
      }
    );
  }
  return themeResolver;
}
