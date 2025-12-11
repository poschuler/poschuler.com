import { createThemeAction } from "remix-themes";

import { getThemeResolver } from "~/sessions/theme-session.server";
import type { Route } from "./+types/action.set-theme";


export async function action({
    context
}: Route.ActionArgs) {
    const themeSessionResolver = getThemeResolver(context.cloudflare.env);
    return createThemeAction(themeSessionResolver);
}