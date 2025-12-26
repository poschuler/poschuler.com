import { type LoaderFunctionArgs } from "react-router";

export async function loader({ context }: LoaderFunctionArgs) {

    const BLOG_KV = context.cloudflare.env.BLOG_KV;
    const kv_key = `sitemap`;
    const contentPayload = await BLOG_KV.get(kv_key, "json");

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
