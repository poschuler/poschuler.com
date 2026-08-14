import fs from "node:fs/promises";
import path from "node:path";
import fm from "front-matter";

import {
    buildSeedSql,
    contentRowFor,
    isInvalid,
    isSkipped,
    type FrontMatterAttributes,
    type SeededRow,
} from "./seed-sql.ts";
import { CONTENT_TREES, unclaimedTrees } from "./content-tree.ts";
import { buildProjectSeedSql, projectRowFor, type ProjectFrontMatter } from "./project-sql.ts";

/** The trees whose files become rows in `content`. Projects have their own. */
const CONTENT_TABLE_TREES = ["blog", "bookmarks"] as const;

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
    // A tree that does not exist yet is empty, not an error: `projects/` has no
    // files until the first one is written, and the schema ships before it.
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
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

/**
 * The `projects/` tree, walked by its own rules into its own table.
 *
 * Separate from the loop above rather than a branch inside it: the two produce
 * rows for different tables, from different front matter, with different
 * invariants. The only thing they share is the tree that decides which one runs
 * (ADR 0004).
 */
async function collectProjectRows(): Promise<SeededRow[]> {
    const filePaths = await getMarkdownFilePaths(path.join(CONTENT_DIR, "projects"));
    const rows: SeededRow[] = [];

    for (const filePath of filePaths) {
        const relativePath = path.relative(CONTENT_DIR, filePath);
        console.log(`Processing ${relativePath}...`);

        const fileContent = await fs.readFile(filePath, "utf-8");
        const { attributes } = fm<ProjectFrontMatter>(fileContent);

        const result = projectRowFor(relativePath, attributes);

        if (isInvalid(result)) {
            throw new Error(result.error);
        }

        if (isSkipped(result)) {
            console.warn(`- Skipping: ${result.reason}`);
            continue;
        }

        rows.push(result);
        console.log(`✅ Generated SQL for project: ${result.key}`);
    }

    return rows;
}

/** Reads the disk; the rule itself lives in `content-tree.ts`. */
async function assertEveryTreeIsClaimed(contentDir: string): Promise<void> {
    const entries = await fs.readdir(contentDir, { withFileTypes: true });
    const unclaimed = unclaimedTrees(
        entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    );

    if (unclaimed.length > 0) {
        throw new Error(
            `app/content holds ${unclaimed.join(", ")}, which no generator walks. ` +
            `Anything in there would publish nothing and say nothing. ` +
            `Known trees: ${Object.keys(CONTENT_TREES).join(", ")}.`,
        );
    }
}

async function generateSqlSeed() {
    console.log("🌱 Starting content analysis for SQL generation...");

    await assertEveryTreeIsClaimed(CONTENT_DIR);

    // Only the trees whose rows land in `content`. Projects have their own
    // table and their own generator — see ADR 0004.
    const filePaths = (
        await Promise.all(
            CONTENT_TABLE_TREES.map((tree) => getMarkdownFilePaths(path.join(CONTENT_DIR, tree))),
        )
    ).flat();

    if (filePaths.length === 0) {
        console.log("No markdown files found in app/content. Exiting.");
        return;
    }

    console.log(`Found ${filePaths.length} markdown files to process.`);

    const rows: SeededRow[] = [];

    for (const filePath of filePaths) {
        const relativePath = path.relative(CONTENT_DIR, filePath);
        console.log(`Processing ${relativePath}...`);

        const fileContent = await fs.readFile(filePath, "utf-8");
        const { attributes } = fm<FrontMatterAttributes>(fileContent);

        const result = contentRowFor(relativePath, attributes);

        if (isInvalid(result)) {
            throw new Error(result.error);
        }

        if (isSkipped(result)) {
            console.warn(`- Skipping: ${result.reason}`);
            continue;
        }

        rows.push(result);
        console.log(`✅ Generated SQL for ${attributes.type}: ${result.key}`);
    }

    const projectRows = await collectProjectRows();

    const sqlCommands = buildSeedSql(rows) + buildProjectSeedSql(projectRows);

    try {
        await fs.mkdir(path.dirname(OUTPUT_SQL_FILE), { recursive: true });
        await fs.writeFile(OUTPUT_SQL_FILE, sqlCommands, "utf-8");

        console.log(`\n\n🌳 SQL generation complete! File saved to: ${OUTPUT_SQL_FILE}`);
        console.log("-----------------------------------------------------------------");
        console.log(`>>> Seed with:`);
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
