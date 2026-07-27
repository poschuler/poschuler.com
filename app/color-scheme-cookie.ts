import { createCookie } from "react-router";
import { createTypedCookie } from "remix-utils/typed-cookie";
import { z } from "zod";

const isProduction = process.env.DEPLOYMENT_ENV === "production";

// Create a cookie using React Router's createCookie API
const cookie = createCookie("poschuler__color-scheme", {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  maxAge: 30 * 24 * 60 * 60,
  secrets: [process.env.SESSION_THEME_SECRET ?? "secret"],
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
