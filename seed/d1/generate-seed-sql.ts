import fs from "node:fs/promises";
import path from "node:path";
import fm from "front-matter";

const CONTENT_DIR = path.join(process.cwd(), "app", "content");
const OUTPUT_SQL_FILE = path.join(process.cwd(), "seed", "d1", "seed.sql");

interface FrontMatterAttributes {
    type: 'post' | 'link';
    repository: string;
    title: string;
    publishedAt: string;
    description?: string;
    externalUrl?: string;
    source?: string;
    tags?: string[];
}

const escapeSql = (text: string | undefined): string => {
    if (text === undefined || text === null) return 'NULL';
    return `'${text.replace(/'/g, "''")}'`;
};

async function getMarkdownFilePaths(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filePromises = entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return getMarkdownFilePaths(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
            return [fullPath];
        }
        return [];
    });

    const nestedFiles = await Promise.all(filePromises);
    return nestedFiles.flat();
}

async function generateSqlSeed() {
    console.log("🌱 Starting content analysis for SQL generation...");

    const filePaths = await getMarkdownFilePaths(CONTENT_DIR);

    if (filePaths.length === 0) {
        console.log("No markdown files found in app/content. Exiting.");
        return;
    }

    console.log(`Found ${filePaths.length} markdown files to process.`);

    // Inserts first, prune last — never `DELETE FROM content` up front. Applied
    // to the remote database, a leading truncate empties the live table and the
    // site serves an empty Timeline until the inserts land. The partial unique
    // indexes on (slug, lang) and (slug) make `INSERT OR REPLACE` a real upsert,
    // so nothing needs clearing to stay idempotent.
    let sqlCommands = "";
    const seededKeys: string[] = [];

    for (const filePath of filePaths) {
        const filename = path.basename(filePath);
        console.log(`Processing ${filename}...`);

        const fileContent = await fs.readFile(filePath, "utf-8");
        const { attributes } = fm<FrontMatterAttributes>(fileContent);

        const match = filename.match(/^(.*?)(?:\.(en|es))?\.md$/);
        if (!match) {
            console.warn(`- Skipping ${filename}: could not parse slug and lang.`);
            continue;
        }

        const slug = match[1];
        const lang = match[2] || null;

        const tagsJson = escapeSql(JSON.stringify(attributes.tags || []));
        const escapedSlug = escapeSql(slug);
        const publishedAt = escapeSql(attributes.publishedAt);


        if (attributes.type === 'post') {
            if (!lang) {
                console.warn(`- Skipping post ${filename}: Posts must have a language in their filename.`);
                continue;
            }

            const escapedLang = escapeSql(lang);
            const title = escapeSql(attributes.title);
            const description = escapeSql(attributes.description);
            const repository = escapeSql(attributes.repository);

            const insertSql = `
INSERT OR REPLACE INTO content (slug, lang, type, title, description, published_at, tags, repository, updated_at)
VALUES (${escapedSlug}, ${escapedLang}, 'post', ${title}, ${description}, ${publishedAt}, ${tagsJson}, ${repository}, CURRENT_TIMESTAMP);
`;
            sqlCommands += insertSql;
            seededKeys.push(`${slug}:${lang}`);
            console.log(`✅ Generated SQL for post: ${slug}.${lang}`);

        } else if (attributes.type === 'link') {

            const title = escapeSql(attributes.title);
            const externalUrl = escapeSql(attributes.externalUrl);
            const source = escapeSql(attributes.source);

            const insertSql = `
INSERT OR REPLACE INTO content (slug, lang, type, title, external_url, source, published_at, tags, updated_at)
VALUES (${escapedSlug}, NULL, 'link', ${title}, ${externalUrl}, ${source}, ${publishedAt}, ${tagsJson}, CURRENT_TIMESTAMP);
`;
            sqlCommands += insertSql;
            seededKeys.push(`${slug}:`);
            console.log(`🔗 Generated SQL for link: ${slug}`);
        }
    }

    // Whatever is left is a Content Item whose Markdown file is gone. The key is
    // `slug:lang` because a Slug alone does not identify a Post — `(slug, lang)`
    // does, and a Bookmark has no Locale.
    const keyList = seededKeys.map((key) => escapeSql(key)).join(", ");
    sqlCommands += `
DELETE FROM content WHERE slug || ':' || ifnull(lang, '') NOT IN (${keyList});
`;

    try {
        await fs.mkdir(path.dirname(OUTPUT_SQL_FILE), { recursive: true });
        await fs.writeFile(OUTPUT_SQL_FILE, sqlCommands, "utf-8");

        console.log(`\n\n🌳 SQL generation complete! File saved to: ${OUTPUT_SQL_FILE}`);
        console.log("-----------------------------------------------------------------");
        console.log(`>>> Ejecute el seeding con el siguiente comando:`);
        console.log(`pnpm exec wrangler d1 execute poschuler --remote --file ${path.relative(process.cwd(), OUTPUT_SQL_FILE)}`);

    } catch (e) {
        console.error("Failed to write SQL file:", e);
    }
}

generateSqlSeed().catch((e) => {
    console.error("SQL generation failed:");
    console.error(e);
    process.exit(1);
});