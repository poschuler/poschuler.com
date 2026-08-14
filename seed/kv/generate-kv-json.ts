import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import fm from "front-matter";
import { renderPostHtml } from "./markdown.ts";
import { generateSitemap } from "../../app/lib/seo/sitemap.ts";
import { buildSitemapRoutes, type SitemapContentItem } from "./sitemap-routes.ts";
import resume from "../../app/routes/resume/resume.json" with { type: "json" };

/**
 * Renders every published Post body and the sitemap into `kv_payloads/`.
 *
 * Reads the *already seeded* D1 table to decide which Posts exist, so D1 must be
 * seeded before this runs. The sanitising lives in `markdown.ts` and the
 * sitemap's route list in `sitemap-routes.ts`; this file is the disk and the
 * subprocess.
 */

const CONTENT_DIR = path.join(process.cwd(), "app", "content", "blog");
const TEMP_JSON_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");
const D1_BINDING_NAME = "poschuler";
const PUBLIC_HOST = "https://poschuler.com";

interface BlogContentPayload { attributes: PostAttributes; html: string; }

interface PostAttributes {
    title: string;
    description: string;
    tags: string[];
    publishedAt: string;
    repository?: string;
}

type ContentRowType = SitemapContentItem & {
    idContent: number;
    lang: string;
    title: string;
    publishedAt: string;
    description: string;
    externalUrl: string;
    source: string;
    tags: string[];
};

function fetchAll(): ContentRowType[] {
    console.log(`\n1. 📡 Fetching content from D1 database: ${D1_BINDING_NAME}...`);

    // Known defect: the nested double quotes are not escaped, so the shell
    // collapses them and SQLite reads the aliases as bare identifiers. It works
    // by accident. Fixing it means single-quoting the aliases, not adding
    // backslashes.
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
            console.warn("   -> ⚠️ WARNING: D1 returned zero rows. Check the 'content' table.");
        }

        return posts;

    } catch (error) {
        console.error("\n❌ ERROR: Failed to execute D1 command.");
        console.error("   Asegúrese de que el binding D1 y la autenticación de Wrangler sean correctos.");
        process.exit(1);
    }
}

async function generateKvJsonFiles() {
    console.log("⚙️ Starting content processing and JSON file generation...");

    const allContentItems = fetchAll();
    const posts = allContentItems.filter((item) => item.type === "post");

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

    // Not the clock. This file is committed and CI compares it against a fresh
    // regeneration, so reading `new Date()` here would turn every change of
    // calendar day into a failed build for content nobody touched. The newest
    // Content Item is the honest answer anyway — a section with nothing in it
    // cannot have changed more recently than the site did — and with no items
    // at all the only date this repo holds is the Resume's.
    const fallbackLastmod = allContentItems[0]?.publishedStringDate ?? resume.meta.lastModified;

    const sitemap = generateSitemap({
        domain: PUBLIC_HOST,
        routes: buildSitemapRoutes(allContentItems, {
            fallbackLastmod,
            resumeLastmod: resume.meta.lastModified,
        }),
    });

    await fs.writeFile(
        path.join(TEMP_JSON_DIR, `sitemap.json`),
        JSON.stringify({ sitemap }, null, 2),
        "utf-8",
    );

    console.log(`   -> ✅ JSON written for key: sitemap`);

    console.log(`\n\n🎉 JSON generation complete! Files are ready for upload.`);
}

generateKvJsonFiles().catch((e) => {
    console.error("JSON generation failed at the top level:");
    console.error(e);
    process.exit(1);
});
