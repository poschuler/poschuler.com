import type { Route } from "./+types/set-theme";
import { redirect } from "react-router";
import { schema, setColorScheme } from "~/color-scheme-cookie";
import { cloudflareContext } from "~/context";

/**
 * Where to send the browser after the cookie is written.
 *
 * Only same-origin destinations are honoured: `Referer` is attacker-influenceable,
 * and following it blindly is an open redirect.
 */
function backTo(request: Request): string {
  const referer = request.headers.get("Referer");

  if (!referer) {
    return "/";
  }

  try {
    const target = new URL(referer);

    if (target.origin !== new URL(request.url).origin) {
      return "/";
    }

    return target.pathname + target.search;
  } catch {
    return "/";
  }
}

// Resource route: the theme toggle lives in the global header, so it needs a
// fixed endpoint to POST to (a plain `Form method="POST"` would hit whatever
// route is currently rendered). No default export — action only.
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const formData = await request.formData();
  const colorScheme = schema.parse(formData.get("color-scheme"));

  // Post/Redirect/Get, so the toggle degrades cleanly. Returning a body works
  // only while JavaScript is around to swallow it: without it the browser
  // navigates here and stays on a page reading `null`.
  return redirect(backTo(request), {
    headers: { "Set-Cookie": await setColorScheme(colorScheme, env) },
  });
}
