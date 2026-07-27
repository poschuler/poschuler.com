import type { Route } from "./+types/set-theme";
import { data } from "react-router";
import { schema, setColorScheme } from "~/color-scheme-cookie";

// Resource route: the theme toggle lives in the global header, so it needs a
// fixed endpoint to POST to (a plain `Form method="POST"` would hit whatever
// route is currently rendered). No default export — action only.
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const colorScheme = schema.parse(formData.get("color-scheme"));
  return data(null, {
    headers: { "Set-Cookie": await setColorScheme(colorScheme) },
  });
}
