import fs from "node:fs/promises";
import path from "node:path";
import fm from "front-matter";

import {
    buildSeedSql,
    contentRowFor,
    isSkipped,
    type FrontMatterAttributes,
    type SeededRow,
} from "./seed-sql.ts";

/**
 * Walks `app/content`, turns every Markdown file into a row, writes `seed.sql`.
 *
 * The rules that decide what becomes a row — filename parsing, the Locale a
 * Post needs, the prune that closes the file — live in `seed-sql.ts` and are
 * tested there. This file is the part that touches the disk.
 */

const CONTENT_DIR = path.join(process.cwd(), "app", "content");
const OUTPUT_SQL_FILE = path.join(process.cwd(), "seed", "d1", "seed.sql");

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

    // Sorted, because `readdir` order is not specified by Node or by POSIX — it
    // is whatever the filesystem hands back. The statement order in `seed.sql`
    // follows it, so without this the same content can regenerate into a
    // different file on a different machine, and CI compares the regenerated
    // file against the committed one.
    return nestedFiles.flat().sort();
}

async function generateSqlSeed() {
    console.log("🌱 Starting content analysis for SQL generation...");

    const filePaths = await getMarkdownFilePaths(CONTENT_DIR);

    if (filePaths.length === 0) {
        console.log("No markdown files found in app/content. Exiting.");
        return;
    }

    console.log(`Found ${filePaths.length} markdown files to process.`);

    const rows: SeededRow[] = [];

    for (const filePath of filePaths) {
        const filename = path.basename(filePath);
        console.log(`Processing ${filename}...`);

        const fileContent = await fs.readFile(filePath, "utf-8");
        const { attributes } = fm<FrontMatterAttributes>(fileContent);

        const result = contentRowFor(filename, attributes);

        if (isSkipped(result)) {
            console.warn(`- Skipping: ${result.reason}`);
            continue;
        }

        rows.push(result);
        console.log(`✅ Generated SQL for ${attributes.type}: ${result.key}`);
    }

    const sqlCommands = buildSeedSql(rows);

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
