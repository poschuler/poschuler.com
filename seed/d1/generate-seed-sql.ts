import fs from "node:fs/promises";
import path from "node:path";
import fm from "front-matter";

import {
    buildSeedSql,
    contentRowFor,
    duplicateKeys,
    isInvalid,
    isSkipped,
    parseContentFilename,
    type ContentRow,
    type FrontMatterAttributes,
    type PartPlacement,
    type SeededRow,
} from "./seed-sql.ts";
import {
    basenameOf,
    CONTENT_TREES,
    isMisplaced,
    pathSegments,
    placementOf,
    unclaimedTrees,
} from "./content-tree.ts";
import { buildProjectSeedSql, projectRowFor, type ProjectFrontMatter } from "./project-sql.ts";
import {
    isMalformedVocabulary,
    tagVocabularyFrom,
    TAG_VOCABULARY_FILE,
    type TagVocabulary,
} from "./tag-vocabulary.ts";
import {
    buildSeriesSeedSql,
    isInvalidSeries,
    seriesRowsFor,
    type SeriesFrontMatter,
    type SeriesPartFile,
} from "./series-sql.ts";

/**
 * The trees whose loose files become rows in `content`. Projects have their
 * own table, and `series/` is walked separately below — it holds two kinds of
 * document at once, and which is which is decided by depth.
 */
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

/** One Series folder, read off the disk and split by what each file is. */
interface SeriesFolder {
    manifests: Array<{ relativePath: string; attributes: SeriesFrontMatter; body: string }>;
    /**
     * The Parts the manifest is reconciled against: only the files carrying a
     * recognised Locale, because a draft is never seeded and so is never
     * indexed either.
     */
    parts: SeriesPartFile[];
    /**
     * Every file below the folder, drafts included — each one still has to be
     * offered a row, if only to be skipped with a reason.
     */
    nested: Array<{ relativePath: string; attributes: FrontMatterAttributes }>;
}

/**
 * Reads `series/` into one entry per Series folder.
 *
 * The manifest and its Parts are told apart by depth, not by a filename
 * convention (`content-tree.ts`): the file named after its folder is that
 * folder, and a subfolder is content living inside it.
 */
async function readSeriesFolders(): Promise<Map<string, SeriesFolder>> {
    const filePaths = await getMarkdownFilePaths(path.join(CONTENT_DIR, "series"));
    const folders = new Map<string, SeriesFolder>();

    for (const filePath of filePaths) {
        const relativePath = path.relative(CONTENT_DIR, filePath);
        console.log(`Processing ${relativePath}...`);

        const placed = placementOf(relativePath);

        if (isMisplaced(placed)) {
            throw new Error(placed.error);
        }

        const segments = pathSegments(relativePath);
        const folderName = segments[1];
        const folder = folders.get(folderName) ?? { manifests: [], parts: [], nested: [] };

        folders.set(folderName, folder);

        const fileContent = await fs.readFile(filePath, "utf-8");

        if (placed.type === "series") {
            const { attributes, body } = fm<SeriesFrontMatter>(fileContent);

            folder.manifests.push({ relativePath, attributes, body });
            continue;
        }

        const { attributes } = fm<FrontMatterAttributes>(fileContent);
        const parsed = parseContentFilename(segments[segments.length - 1]);

        folder.nested.push({ relativePath, attributes });

        if (parsed?.lang) {
            folder.parts.push({
                slug: parsed.slug,
                lang: parsed.lang,
                folder: segments[segments.length - 2],
                relativePath,
            });
        }
    }

    return folders;
}

/**
 * The `series/` tree: two tables of its own, plus the Container columns on
 * every Part's row in `content`.
 *
 * The manifest is read first because it is the only thing that knows where a
 * Part sits — see ADR 0007 — so a Part's row cannot be written until its
 * Series has been validated and its lists turned into positions.
 */
async function collectSeriesRows(vocabulary: TagVocabulary): Promise<{
    series: SeededRow[];
    sections: SeededRow[];
    content: ContentRow[];
}> {
    const folders = await readSeriesFolders();
    const series: SeededRow[] = [];
    const sections: SeededRow[] = [];
    const content: ContentRow[] = [];

    for (const [folderName, folder] of folders) {
        if (folder.manifests.length === 0) {
            throw new Error(
                `app/content/series/${folderName} holds Parts and no manifest — nothing would order them or say what the series is for`,
            );
        }

        const placements = new Map<string, PartPlacement>();
        const locales = new Set<string>();

        for (const manifest of folder.manifests) {
            const parsed = parseContentFilename(basenameOf(manifest.relativePath));
            const locale = parsed?.lang;

            if (!locale) {
                throw new Error(`${manifest.relativePath} must have a language in its filename`);
            }

            locales.add(locale);

            const result = seriesRowsFor(
                manifest.relativePath,
                manifest.attributes,
                manifest.body,
                folder.parts.filter((part) => part.lang === locale),
            );

            if (isInvalidSeries(result)) {
                throw new Error(result.error);
            }

            series.push(result.series);
            sections.push(...result.sections);

            for (const [slug, placement] of result.parts) {
                placements.set(`${slug}:${locale}`, placement);
            }

            console.log(`✅ Generated SQL for series: ${result.series.key}`);
        }

        // A Part in a Locale its Series does not have would otherwise be
        // reconciled against nothing and seeded with no Container.
        for (const part of folder.parts) {
            if (!locales.has(part.lang)) {
                throw new Error(
                    `${part.relativePath} is in '${part.lang}' and ${folderName} has no manifest in that Locale`,
                );
            }
        }

        for (const file of folder.nested) {
            const parsed = parseContentFilename(basenameOf(file.relativePath));
            const placement = parsed?.lang
                ? placements.get(`${parsed.slug}:${parsed.lang}`)
                : undefined;

            const result = contentRowFor(file.relativePath, file.attributes, vocabulary, placement);

            if (isInvalid(result)) {
                throw new Error(result.error);
            }

            if (isSkipped(result)) {
                console.warn(`- Skipping: ${result.reason}`);
                continue;
            }

            content.push(result);
            console.log(`✅ Generated SQL for part: ${result.key}`);
        }
    }

    return { series, sections, content };
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

/**
 * Reads the declared vocabulary; the rules it is held to live in
 * `tag-vocabulary.ts`, beside the check every Post and Bookmark is measured by.
 *
 * A missing or unparseable file stops the build rather than defaulting to an
 * empty set: an empty vocabulary would reject every Tag on the site, and a
 * default that accepts everything would be the check quietly turning itself off.
 */
async function readTagVocabulary(): Promise<TagVocabulary> {
    const filePath = path.join(process.cwd(), TAG_VOCABULARY_FILE);
    let declared: unknown;

    try {
        declared = JSON.parse(await fs.readFile(filePath, "utf-8"));
    } catch (cause) {
        throw new Error(
            `${TAG_VOCABULARY_FILE} could not be read as JSON — it declares every Tag this site may use, ` +
            `and no Tag can be checked without it: ${(cause as Error).message}`,
        );
    }

    const result = tagVocabularyFrom(declared);

    if (isMalformedVocabulary(result)) {
        throw new Error(result.error);
    }

    return result.vocabulary;
}

async function generateSqlSeed() {
    console.log("🌱 Starting content analysis for SQL generation...");

    await assertEveryTreeIsClaimed(CONTENT_DIR);

    const vocabulary = await readTagVocabulary();

    console.log(`Read ${vocabulary.size} declared Tags from ${TAG_VOCABULARY_FILE}.`);

    // Only the trees whose rows land in `content`. Projects have their own
    // table and their own generator — see ADR 0004.
    const filePaths = (
        await Promise.all(
            CONTENT_TABLE_TREES.map((tree) => getMarkdownFilePaths(path.join(CONTENT_DIR, tree))),
        )
    ).flat();

    console.log(`Found ${filePaths.length} markdown files to process.`);

    const rows: ContentRow[] = [];

    for (const filePath of filePaths) {
        const relativePath = path.relative(CONTENT_DIR, filePath);
        console.log(`Processing ${relativePath}...`);

        const fileContent = await fs.readFile(filePath, "utf-8");
        const { attributes } = fm<FrontMatterAttributes>(fileContent);

        const result = contentRowFor(relativePath, attributes, vocabulary);

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
    const seriesRows = await collectSeriesRows(vocabulary);

    rows.push(...seriesRows.content);

    // The guard `buildSeedSql` documents but does not make: with no rows its
    // prune matches everything, so an empty walk would empty the live table.
    // It has to sit after the Series tree is walked, because `blog/` and
    // `bookmarks/` are no longer the only places a Content Item comes from.
    if (rows.length === 0) {
        console.log("No content items found in app/content. Exiting.");
        return;
    }

    // `content` is unique on (Slug, Locale) site-wide, not per tree, so a Part
    // competes with every loose Post. Caught here rather than by the database
    // partway through seeding the deployed store.
    const duplicates = duplicateKeys(rows);

    if (duplicates.length > 0) {
        throw new Error(
            `two Content Items claim the same identity: ${duplicates.join(", ")}. ` +
            `A Slug is unique across the whole site, not within a tree.`,
        );
    }

    const sqlCommands =
        buildSeedSql(rows) +
        buildProjectSeedSql(projectRows) +
        buildSeriesSeedSql(seriesRows.series, seriesRows.sections);

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
