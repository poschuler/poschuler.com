import { type LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/context";

export async function loader({ context }: LoaderFunctionArgs) {

    const { env } = context.get(cloudflareContext);
    const BLOG_KV = env.BLOG_KV;
    const kv_key = `sitemap`;
    const contentPayload = await BLOG_KV.get<{ sitemap: string }>(kv_key, {
        type: "json",
        // Lets the colo answer from its own cache instead of paying a round
        // trip to KV's central store on every miss.
        cacheTtl: 3600,
    });

    if (!contentPayload) {
        throw new Response("Not Found", { status: 404 });
    }

    const { sitemap } = contentPayload;

    return new Response(sitemap, {
        headers: {
            "Content-Type": "text/xml",
            // Rewritten only by the seed pipeline, so an hour of staleness is
            // harmless — and it keeps the Worker out of the hot path entirely.
            "Cache-Control": "public, max-age=3600",
        },
    });
}
