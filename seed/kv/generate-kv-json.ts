import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import fm from "front-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "app", "content", "blog");
const TEMP_JSON_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");
const D1_BINDING_NAME = "poschuler";

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


function fetchRemoteSlugs(): ContentRowType[] {
    console.log(`\n1. 📡 Fetching slugs from remote D1 database: ${D1_BINDING_NAME}...`);

    const d1Command = `wrangler d1 execute ${D1_BINDING_NAME} --command "select id_content as "idContent", slug as "slug", lang as "lang", type as "type", title as "title", published_at as "publishedAt", strftime('%Y-%m-%d', published_at) AS "publishedStringDate", description as "description", external_url as "externalUrl", source as "source", tags as "tags" from content where type = 'post' order by published_at desc" --json`;

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

    const posts = fetchRemoteSlugs();
    if (posts.length === 0) return;

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

            const html = await marked.parse(body);

            const payload: BlogContentPayload = { attributes, html };

            await fs.writeFile(jsonFilePath, JSON.stringify(payload, null, 2), "utf-8");

            console.log(`   -> ✅ JSON written for key: blog:${slug}.${lang}`);

        } catch (e) {
            console.error(`   -> ❌ ERROR: Failed to process ${filePath}. Check if the file exists or is valid Markdown.`);
        }
    }

    console.log(`\n\n🎉 JSON generation complete! Files are ready for upload.`);
}

generateKvJsonFiles().catch((e) => {
    console.error("JSON generation failed at the top level:");
    console.error(e);
    process.exit(1);
});