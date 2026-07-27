import { type LoaderFunctionArgs } from "react-router";
import { cloudflareContext } from "~/context";

export async function loader({ context }: LoaderFunctionArgs) {

    const { env } = context.get(cloudflareContext);
    const BLOG_KV = env.BLOG_KV;
    const kv_key = `sitemap`;
    const contentPayload = await BLOG_KV.get<{ sitemap: string }>(kv_key, "json");

    if (!contentPayload) {
        throw new Response("Not Found", { status: 404 });
    }

    const { sitemap } = contentPayload;

    return new Response(sitemap, {
        headers: {
            "Content-Type": "text/xml",
        },
    });
}
