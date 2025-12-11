import { generateSitemap, type SitemapRoute } from "@forge42/seo-tools/sitemap";
import { type LoaderFunctionArgs } from "react-router";
import { findAll } from "~/models/content.server";

export async function loader({ request }: LoaderFunctionArgs) {
    //const isProduction = process.env.DEPLOYMENT_ENV === "production";
    //const domain = new URL(request.url).origin;
    const allContentItems = await findAll();
    const posts = allContentItems.filter((item) => item.type === "post");
    const bookmarks = allContentItems.filter((item) => item.type === "link");

    const todayString = new Date().toISOString().split("T")[0];

    const lastContentDate = allContentItems.length > 0 ? allContentItems[0].publishedStringDate : todayString;
    const lastPostDate = posts.length > 0 ? posts[0].publishedStringDate : todayString;
    const lastBookmarkDate = bookmarks.length > 0 ? bookmarks[0].publishedStringDate : todayString;

    if (typeof process.env.PUBLIC_HOST !== "string") {
        throw new Error("Missing env: PUBLIC_HOST");
    }

    const stringUrl = process.env.PUBLIC_HOST;
    //const baseUrl = new URL(stringUrl);

    const postRoutes = posts.map((post) => {
        return {
            url: `/blog/${post.slug}`,
            lastmod: post.publishedStringDate,
            changefreq: "monthly",
            priority: 0.7,
        } as SitemapRoute;
    })

    const sitemap = await generateSitemap(
        {
            domain: stringUrl,
            ignore: [],
            routes: [
                { url: "/", lastmod: lastContentDate, changefreq: "monthly", priority: 1.0 },
                { url: "/cv", lastmod: "2025-11-01", changefreq: "monthly", priority: 0.8 },
                { url: "/blog", lastmod: lastPostDate, changefreq: "monthly", priority: 0.6 },
                { url: "/bookmarks", lastmod: lastBookmarkDate, changefreq: "monthly", priority: 0.5 },
                ...postRoutes
            ],
        }
    );

    return new Response(sitemap, {
        headers: {
            "Content-Type": "text/xml",
        },
    });
}
