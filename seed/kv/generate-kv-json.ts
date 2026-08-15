import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import fm from "front-matter";
import { renderPostHtml } from "./markdown.ts";
import { generateSitemap } from "../../app/lib/seo/sitemap.ts";
import {
    buildSitemapRoutes,
    type SitemapContentItem,
    type SitemapProject,
} from "./sitemap-routes.ts";
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
const PROJECT_CONTENT_DIR = path.join(process.cwd(), "app", "content", "projects");
const SERIES_CONTENT_DIR = path.join(process.cwd(), "app", "content", "series");
const TEMP_JSON_DIR = path.join(process.cwd(), "seed", "kv", "kv_payloads");
const D1_BINDING_NAME = "poschuler";
const PUBLIC_HOST = "https://poschuler.com";

/**
 * One rendered document: its front matter, verbatim, and its body as HTML.
 *
 * `attributes` is deliberately untyped. Three kinds of document go through this
 * — a Post, a Project and a Series landing — and the payload carries whatever
 * the file declared; what each route reads out of it is the route's business.
 */
interface RenderedDocument { attributes: Record<string, unknown>; html: string; }

type ProjectRowType = SitemapProject & {
    lang: string;
};

type ContentRowType = SitemapContentItem & {
    idContent: number;
    lang: string;
    title: string;
    publishedAt: string;
    description: string;
    externalUrl: string;
    source: string;
    tags: string[];
    /**
     * The Container, when the Post has one. It is what says where the Markdown
     * is: a Part lives under its Series, not under `blog/`.
     */
    seriesSlug: string | null;
};

type SeriesRowType = {
    slug: string;
    lang: string;
};

/** Runs one read against the local D1 and returns its rows. */
function queryD1<Row>(sql: string): Row[] {
    const command = `pnpm exec wrangler d1 execute ${D1_BINDING_NAME} --command "${sql}" --json`;

    try {
        const results = JSON.parse(execSync(command, { encoding: "utf-8", stdio: "pipe" }));

        if (Array.isArray(results) && results[0]?.results) {
            return results[0].results as Row[];
        }

        return (results?.results ?? []) as Row[];
    } catch {
        console.error("\n❌ ERROR: Failed to execute D1 command.");
        console.error("   Check the D1 binding and that Wrangler is authenticated.");
        process.exit(1);
    }
}

function fetchAll(): ContentRowType[] {
    console.log(`\n1. 📡 Fetching content from D1 database: ${D1_BINDING_NAME}...`);

    // Known defect: the nested double quotes are not escaped, so the shell
    // collapses them and SQLite reads the aliases as bare identifiers. It works
    // by accident. Fixing it means single-quoting the aliases, not adding
    // backslashes.
    const rows = queryD1<ContentRowType>(
        `select id_content as "idContent", slug as "slug", lang as "lang", type as "type", title as "title", published_at as "publishedAt", strftime('%Y-%m-%d', published_at) AS "publishedStringDate", description as "description", external_url as "externalUrl", source as "source", tags as "tags", updates as "updates", series_slug as "seriesSlug" from content order by published_at desc`,
    );

    if (!rows.length) {
        console.warn("   -> ⚠️ WARNING: D1 returned zero rows. Check the 'content' table.");
    }

    return rows;
}

/**
 * The Projects, ordered the way the index renders them.
 *
 * No warning when there are none: unlike `content`, an empty `project` table is
 * an ordinary state — the schema ships before the first Project is written.
 */
function fetchAllProjects(): ProjectRowType[] {
    return queryD1<ProjectRowType>(
        `select slug as "slug", lang as "lang", updates as "updates" from project order by sort_order asc, slug asc`,
    );
}

/**
 * The Series landings, whose bodies are rendered like any other document's.
 *
 * A Series has no date of its own — what changes on its landing is that a Part
 * arrived — so there is nothing here to order by but the Slug.
 */
function fetchAllSeries(): SeriesRowType[] {
    return queryD1<SeriesRowType>(
        `select slug as "slug", lang as "lang" from series order by slug asc`,
    );
}

/**
 * Renders one Markdown body into its payload.
 *
 * Throws rather than logging and carrying on, which is what this used to do: a
 * body that failed to render left the row seeded and the key absent, so the
 * Post listed, linked and indexed with a page that 404s its own content — the
 * same silent shape ADR 0004 removes from the classification rules.
 */
async function writePayload(
    sourcePath: string,
    outputDir: string,
    slug: string,
    lang: string,
): Promise<void> {
    let fileContent: string;

    try {
        fileContent = await fs.readFile(sourcePath, "utf-8");
    } catch {
        throw new Error(`${sourcePath} is seeded in D1 but not on disk — nothing would render it`);
    }

    const { attributes, body } = fm<Record<string, unknown>>(fileContent);
    const html = await renderPostHtml(body);
    const payload: RenderedDocument = { attributes, html };

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
        path.join(outputDir, `${slug}.${lang}.json`),
        JSON.stringify(payload, null, 2),
        "utf-8",
    );
}

async function generateKvJsonFiles() {
    console.log("⚙️ Starting content processing and JSON file generation...");

    const allContentItems = fetchAll();
    const posts = allContentItems.filter((item) => item.type === "post");
    const projects = fetchAllProjects();
    const series = fetchAllSeries();

    await fs.rm(TEMP_JSON_DIR, { recursive: true, force: true });
    await fs.mkdir(TEMP_JSON_DIR, { recursive: true });

    console.log(`\n2. 📄 Found ${posts.length} posts, ${projects.length} projects and ${series.length} series. Writing JSON files to ${TEMP_JSON_DIR}...`);

    for (const post of posts) {
        const { slug, lang, seriesSlug } = post;

        // Where the Markdown is, which is not where the payload goes: a Part
        // lives under its Series on disk and under `blog:` in KV.
        const sourcePath = seriesSlug
            ? path.join(SERIES_CONTENT_DIR, seriesSlug, slug, `${slug}.${lang}.md`)
            : path.join(CONTENT_DIR, slug, `${slug}.${lang}.md`);

        await writePayload(sourcePath, path.join(TEMP_JSON_DIR, "blog"), slug, lang);

        console.log(`   -> ✅ JSON written for key: blog:${slug}:${lang}`);
    }

    for (const { slug, lang } of series) {
        await writePayload(
            path.join(SERIES_CONTENT_DIR, slug, `${slug}.${lang}.md`),
            path.join(TEMP_JSON_DIR, "series"),
            slug,
            lang,
        );

        console.log(`   -> ✅ JSON written for key: series:${slug}:${lang}`);
    }

    for (const project of projects) {
        const { slug, lang } = project;

        await writePayload(
            path.join(PROJECT_CONTENT_DIR, slug, `${slug}.${lang}.md`),
            path.join(TEMP_JSON_DIR, "projects"),
            slug,
            lang,
        );

        console.log(`   -> ✅ JSON written for key: project:${slug}:${lang}`);
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
        routes: buildSitemapRoutes(
            allContentItems,
            { fallbackLastmod, resumeLastmod: resume.meta.lastModified },
            projects,
        ),
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
