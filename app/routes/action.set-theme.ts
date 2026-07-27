import { createThemeAction } from "remix-themes";

import { getThemeResolver } from "~/sessions/theme-session.server";
import { cloudflareContext } from "~/context";
import type { Route } from "./+types/action.set-theme";


export async function action({
    context
}: Route.ActionArgs) {
    const { env } = context.get(cloudflareContext);
    const themeSessionResolver = getThemeResolver(env);
    return createThemeAction(themeSessionResolver);
}