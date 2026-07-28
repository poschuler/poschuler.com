import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import fm from "front-matter";
import { renderPostHtml } from "./markdown.ts";
import { generateSitemap, type SitemapRoute } from "../../app/lib/seo/sitemap.ts";

const CONTENT_DIR = path.join(process.cwd(), "app", "content", "blog");
const TEMP_JSON_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");
const D1_BINDING_NAME = "poschuler";
const PUBLIC_HOST = "https://poschuler.com";

interface BlogContentPayload { attributes: any; html: string; }

type ContentRowType = {
    idContent: number;
    slug: string;
    lang: string;
    type: string;
    title: string;
    publishedAt: string;
    publishedStringDate: string;
    description: string;
    externalUrl: string;
    source: string;
    tags: string[];
};


function fetchSlugs(): ContentRowType[] {
    console.log(`\n1. 📡 Fetching slugs from D1 database: ${D1_BINDING_NAME}...`);

    const d1Command = `pnpm exec wrangler d1 execute ${D1_BINDING_NAME} --command "select id_content as "idContent", slug as "slug", lang as "lang", type as "type", title as "title", published_at as "publishedAt", strftime('%Y-%m-%d', published_at) AS "publishedStringDate", description as "description", external_url as "externalUrl", source as "source", tags as "tags" from content where type = 'post' order by published_at desc" --json`;

    try {
        const output = execSync(d1Command, { encoding: 'utf-8', stdio: 'pipe' });

        const results = JSON.parse(output);

        let posts: ContentRowType[] = [];
        if (Array.isArray(results) && results[0]?.results) {
            posts = results[0].results as ContentRowType[];
        } else if (results?.results) {
            posts = results.results as ContentRowType[];
        }

        if (!posts.length) {
            console.warn("   -> ⚠️ WARNING: D1 returned zero blog posts. Check the 'content' table.");
        }

        return posts;

    } catch (error) {
        console.error("\n❌ ERROR: Failed to execute D1 command.");
        console.error("   Asegúrese de que el binding D1 y la autenticación de Wrangler sean correctos.");
        process.exit(1);
    }
}

function fetchAll(): ContentRowType[] {
    console.log(`\n1. 📡 Fetching slugs from D1 database: ${D1_BINDING_NAME}...`);

    const d1Command = `pnpm exec wrangler d1 execute ${D1_BINDING_NAME} --command "select id_content as "idContent", slug as "slug", lang as "lang", type as "type", title as "title", published_at as "publishedAt", strftime('%Y-%m-%d', published_at) AS "publishedStringDate", description as "description", external_url as "externalUrl", source as "source", tags as "tags" from content order by published_at desc" --json`;

    try {
        const output = execSync(d1Command, { encoding: 'utf-8', stdio: 'pipe' });

        const results = JSON.parse(output);

        let posts: ContentRowType[] = [];
        if (Array.isArray(results) && results[0]?.results) {
            posts = results[0].results as ContentRowType[];
        } else if (results?.results) {
            posts = results.results as ContentRowType[];
        }

        if (!posts.length) {
            console.warn("   -> ⚠️ WARNING: D1 returned zero blog posts. Check the 'content' table.");
        }

        return posts;

    } catch (error) {
        console.error("\n❌ ERROR: Failed to execute D1 command.");
        console.error("   Asegúrese de que el binding D1 y la autenticación de Wrangler sean correctos.");
        process.exit(1);
    }
}

interface PostAttributes {
    title: string;
    description: string;
    tags: string[];
    publishedAt: string;
    repository?: string;
}

async function generateKvJsonFiles() {
    console.log("⚙️ Starting content processing and JSON file generation...");

    const allContentItems = fetchAll();
    const posts = allContentItems.filter((item) => item.type === "post");
    const bookmarks = allContentItems.filter((item) => item.type === "link");

    //if (posts.length === 0) return;

    await fs.rm(TEMP_JSON_DIR, { recursive: true, force: true });
    await fs.mkdir(TEMP_JSON_DIR, { recursive: true });

    console.log(`\n2. 📄 Found ${posts.length} posts to process. Writing JSON files to ${TEMP_JSON_DIR}...`);

    for (const post of posts) {
        const { slug, lang } = post;

        const filePath = path.join(CONTENT_DIR, slug, `${slug}.${lang}.md`);
        const jsonFilePath = path.join(TEMP_JSON_DIR, `${slug}.${lang}.json`);

        try {
            const fileContent = await fs.readFile(filePath, "utf-8");
            const { attributes, body } = fm<PostAttributes>(fileContent);

            const html = await renderPostHtml(body);

            const payload: BlogContentPayload = { attributes, html };

            await fs.writeFile(jsonFilePath, JSON.stringify(payload, null, 2), "utf-8");

            console.log(`   -> ✅ JSON written for key: blog:${slug}.${lang}`);

        } catch (e) {
            console.error(`   -> ❌ ERROR: Failed to process ${filePath}. Check if the file exists or is valid Markdown.`);
        }
    }



    const todayString = new Date().toISOString().split("T")[0];

    const lastContentDate = allContentItems.length > 0 ? allContentItems[0].publishedStringDate : todayString;
    const lastPostDate = posts.length > 0 ? posts[0].publishedStringDate : todayString;
    const lastBookmarkDate = bookmarks.length > 0 ? bookmarks[0].publishedStringDate : todayString;

    const stringUrl = PUBLIC_HOST;
    //const baseUrl = new URL(stringUrl);

    const postRoutes = posts.map((post) => {
        return {
            url: `/blog/${post.slug}`,
            lastmod: post.publishedStringDate,
            changefreq: "monthly",
            priority: 0.7,
        } as SitemapRoute;
    })

    const sitemap = generateSitemap(
        {
            domain: stringUrl,
            routes: [
                { url: "/", lastmod: lastContentDate, changefreq: "monthly", priority: 1.0 },
                { url: "/resume", lastmod: "2025-12-21", changefreq: "monthly", priority: 0.8 },
                { url: "/blog", lastmod: lastPostDate, changefreq: "monthly", priority: 0.6 },
                { url: "/bookmarks", lastmod: lastBookmarkDate, changefreq: "monthly", priority: 0.5 },
                ...postRoutes
            ],
        }
    );

    const jsonFilePath = path.join(TEMP_JSON_DIR, `sitemap.json`);
    const payload = { sitemap };

    await fs.writeFile(jsonFilePath, JSON.stringify(payload, null, 2), "utf-8");

    console.log(`   -> ✅ JSON written for key: sitemaps`);

    console.log(`\n\n🎉 JSON generation complete! Files are ready for upload.`);
}

generateKvJsonFiles().catch((e) => {
    console.error("JSON generation failed at the top level:");
    console.error(e);
    process.exit(1);
});