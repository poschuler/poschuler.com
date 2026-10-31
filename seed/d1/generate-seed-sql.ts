import fs from "node:fs/promises";
import path from "node:path";
import fm from "front-matter";

import {
    buildSeedSql,
    contentRowFor,
    draftError,
    duplicateKeys,
    isDraft,
    isInvalid,
    isSkipped,
    parseContentFilename,
    type ContentRow,
    type DraftOptions,
    type FrontMatterAttributes,
    type NotePlacement,
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
import {
    buildProjectSeedSql,
    isInvalidProject,
    projectRowFor,
    type ProjectFrontMatter,
    type ProjectNoteFile,
} from "./project-sql.ts";
import {
    isMalformedVocabulary,
    tagVocabularyFrom,
    TAG_VOCABULARY_FILE,
    type TagVocabulary,
} from "./tag-vocabulary.ts";

/**
 * The trees whose loose files become rows in `content`. `projects/` is
 * walked separately below — it holds two kinds of document at once (a
 * Project's own manifest, and the Field Notes nested inside it), and which is
 * which is decided by depth.
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
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "seed", "d1");

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
 * A file nested under a Container folder — what a Project's manifest is
 * reconciled against. It is `ProjectNoteFile`'s shape, which TypeScript accepts
 * structurally without a cast.
 */
interface ContainerChildFile {
    slug: string;
    lang: string;
    folder: string;
    relativePath: string;
    draft: boolean;
}

/** One Container folder — a Project — split by what each file is. */
interface ContainerFolder<Manifest> {
    manifests: Array<{ relativePath: string; attributes: Manifest; body: string }>;
    /**
     * The files the manifest is reconciled against: only the ones carrying a
     * recognised Locale — a file whose suffix does not parse to one is not a
     * legitimate state to reconcile against anything, and `contentRowFor`
     * fails the build on it below rather than this walker excusing it here. A
     * draft declared with `draft: true`, by contrast, has a Locale like any
     * other file and is reconciled the same way, with `draft: true` set on
     * the entry so the manifest's own row builder can tell it apart.
     */
    files: ContainerChildFile[];
    /**
     * Every file below the folder, drafts and unrecognised Locales included —
     * each one still has to be offered a row, if only to fail the build with
     * a message naming it.
     */
    nested: Array<{ relativePath: string; attributes: FrontMatterAttributes }>;
}

/**
 * Reads the `projects/` tree into one entry per Project folder: the manifest
 * (one per Locale), the content it can be reconciled against, and every file at
 * all.
 *
 * The manifest and its content are told apart by depth, not by a filename
 * convention (`content-tree.ts`): the file named after its folder is that
 * folder, and a subfolder is content living inside it.
 */
async function readContainerFolders<Manifest>(
    tree: "projects",
    itemType: "project",
): Promise<Map<string, ContainerFolder<Manifest>>> {
    const filePaths = await getMarkdownFilePaths(path.join(CONTENT_DIR, tree));
    const folders = new Map<string, ContainerFolder<Manifest>>();

    for (const filePath of filePaths) {
        const relativePath = path.relative(CONTENT_DIR, filePath);
        console.log(`Processing ${relativePath}...`);

        const placed = placementOf(relativePath);

        if (isMisplaced(placed)) {
            throw new Error(placed.error);
        }

        const segments = pathSegments(relativePath);
        const folderName = segments[1];
        const folder = folders.get(folderName) ?? { manifests: [], files: [], nested: [] };

        folders.set(folderName, folder);

        const fileContent = await fs.readFile(filePath, "utf-8");

        if (placed.type === itemType) {
            const { attributes, body } = fm<Manifest>(fileContent);

            folder.manifests.push({ relativePath, attributes, body });
            continue;
        }

        const { attributes } = fm<FrontMatterAttributes>(fileContent);
        const parsed = parseContentFilename(segments[segments.length - 1]);

        folder.nested.push({ relativePath, attributes });

        if (parsed?.lang) {
            // Checked here, ahead of `contentRowFor`, and not left to run
            // there alone: the manifest's own row builder reads this file's
            // `draft` below to decide the Container-contradiction check,
            // before `contentRowFor` ever sees this file. A malformed value
            // must fail with its own message rather than being read as
            // "published" and surfacing as a confusing contradiction against a
            // manifest that never had one.
            const draftProblem = draftError(relativePath, attributes.draft);

            if (draftProblem) {
                throw new Error(draftProblem);
            }

            folder.files.push({
                slug: parsed.slug,
                lang: parsed.lang,
                folder: segments[segments.length - 2],
                relativePath,
                draft: isDraft(attributes.draft),
            });
        }
    }

    return folders;
}

/**
 * Reads `projects/` into one entry per Project folder.
 */
function readProjectFolders(): Promise<Map<string, ContainerFolder<ProjectFrontMatter>>> {
    return readContainerFolders<ProjectFrontMatter>("projects", "project");
}

/**
 * The `projects/` tree: the `project` table, plus the Container columns on
 * every Field Note's row in `content`.
 *
 * The manifest is read first because it is the only thing that knows where a
 * note sits — see ADR 0007 — so a note's row cannot be written until its
 * Project has been validated and its list turned into positions.
 */
async function collectProjectRows(vocabulary: TagVocabulary, options: DraftOptions): Promise<{
    project: SeededRow[];
    content: ContentRow[];
    /**
     * Distinct from `project.length > 0`: every Project manifest this walk
     * found may have declared `draft: true`, and `buildProjectSeedSql` needs
     * to tell that state apart from "nothing has ever been written" to know
     * whether an empty `project` still calls for a prune. A folder existing at
     * all already guarantees at least one manifest was read — see the throw
     * just below.
     */
    anyFilesFound: boolean;
}> {
    const folders = await readProjectFolders();
    const project: SeededRow[] = [];
    const content: ContentRow[] = [];

    for (const [folderName, folder] of folders) {
        if (folder.manifests.length === 0) {
            throw new Error(
                `app/content/projects/${folderName} holds notes and no manifest — nothing would order them or say what the project is for`,
            );
        }

        const placements = new Map<string, NotePlacement>();
        const locales = new Set<string>();

        for (const manifest of folder.manifests) {
            const parsed = parseContentFilename(basenameOf(manifest.relativePath));
            const locale = parsed?.lang;

            if (!locale) {
                throw new Error(`${manifest.relativePath} must have a language in its filename`);
            }

            locales.add(locale);

            const result = projectRowFor(
                manifest.relativePath,
                manifest.attributes,
                folder.files.filter((note) => note.lang === locale),
            );

            if (isInvalidProject(result)) {
                throw new Error(result.error);
            }

            // The placements are needed either way: a drafted Container's own
            // notes must themselves be drafts (the Container-contradiction
            // check `projectRowFor` already ran), and each still has to be
            // listed and reconciled like any other.
            for (const [slug, placement] of result.notes) {
                placements.set(`${slug}:${locale}`, placement);
            }

            if (result.draft && !options.includeDrafts) {
                console.warn(`- Skipping: ${manifest.relativePath} is a draft`);
                continue;
            }

            project.push(result.project);

            console.log(`✅ Generated SQL for project: ${result.project.key}`);
        }

        // A note in a Locale its Project does not have would otherwise be
        // reconciled against nothing and seeded with no Container.
        for (const note of folder.files) {
            if (!locales.has(note.lang)) {
                throw new Error(
                    `${note.relativePath} is in '${note.lang}' and ${folderName} has no manifest in that Locale`,
                );
            }
        }

        for (const file of folder.nested) {
            const parsed = parseContentFilename(basenameOf(file.relativePath));
            const placement = parsed?.lang
                ? placements.get(`${parsed.slug}:${parsed.lang}`)
                : undefined;

            const result = contentRowFor(file.relativePath, file.attributes, vocabulary, placement, options);

            if (isInvalid(result)) {
                throw new Error(result.error);
            }

            if (isSkipped(result)) {
                console.warn(`- Skipping: ${result.reason}`);
                continue;
            }

            content.push(result);
            console.log(`✅ Generated SQL for note: ${result.key}`);
        }
    }

    return { project, content, anyFilesFound: folders.size > 0 };
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

/**
 * Reads `app/content`, writes `<outputDir>/seed.sql`.
 *
 * Two parameters, not a second pipeline: called with neither, this is
 * byte-for-byte what it always was. `preview:drafts` is the only caller that
 * passes either — an output directory outside `seed/d1/`, so nothing tracked
 * is touched, and `includeDrafts`, so a Draft is read like a published
 * document instead of being skipped.
 */
async function generateSqlSeed({
    outputDir = DEFAULT_OUTPUT_DIR,
    includeDrafts = false,
}: { outputDir?: string; includeDrafts?: boolean } = {}) {
    console.log("🌱 Starting content analysis for SQL generation...");

    const options: DraftOptions = { includeDrafts };
    const outputSqlFile = path.join(outputDir, "seed.sql");

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

        const result = contentRowFor(relativePath, attributes, vocabulary, undefined, options);

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

    const projectRows = await collectProjectRows(vocabulary, options);

    rows.push(...projectRows.content);

    // The guard `buildSeedSql` documents but does not make: with no rows its
    // prune matches everything, so an empty walk would empty the live table.
    // It has to sit after the Project tree is walked, because
    // `blog/` and `bookmarks/` are no longer the only places a Content Item
    // comes from.
    if (rows.length === 0) {
        console.log("No content items found in app/content. Exiting.");
        return;
    }

    // `content` is unique on (Slug, Locale) site-wide, not per tree, so a Field
    // Note competes with every loose Post. Caught here rather than
    // by the database partway through seeding the deployed store.
    const duplicates = duplicateKeys(rows);

    if (duplicates.length > 0) {
        throw new Error(
            `two Content Items claim the same identity: ${duplicates.join(", ")}. ` +
            `A Slug is unique across the whole site, not within a tree.`,
        );
    }

    const sqlCommands =
        buildSeedSql(rows) +
        buildProjectSeedSql(projectRows.project, { anyFilesFound: projectRows.anyFilesFound });

    try {
        await fs.mkdir(path.dirname(outputSqlFile), { recursive: true });
        await fs.writeFile(outputSqlFile, sqlCommands, "utf-8");

        console.log(`\n\n🌳 SQL generation complete! File saved to: ${outputSqlFile}`);
        console.log("-----------------------------------------------------------------");
        console.log(`>>> Seed with:`);
        console.log(`pnpm exec wrangler d1 execute poschuler --remote --file ${path.relative(process.cwd(), outputSqlFile)}`);

    } catch (e) {
        console.error("Failed to write SQL file:", e);
    }
}

/**
 * `--output-dir <dir>` and `--include-drafts`, both optional. This file sits
 * outside the coverage target for the same reason the other seed scripts do
 * — it is disk and subprocess wiring around the tested pure functions above —
 * so the flags are parsed by hand rather than pulled in a dependency.
 */
function parseArgs(argv: string[]): { outputDir?: string; includeDrafts: boolean } {
    let outputDir: string | undefined;
    let includeDrafts = false;

    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--output-dir") {
            outputDir = argv[++i];
        } else if (argv[i] === "--include-drafts") {
            includeDrafts = true;
        }
    }

    return { outputDir, includeDrafts };
}

const { outputDir, includeDrafts } = parseArgs(process.argv.slice(2));

generateSqlSeed({
    outputDir: outputDir ? path.resolve(process.cwd(), outputDir) : undefined,
    includeDrafts,
}).catch((e) => {
    console.error("SQL generation failed:");
    console.error(e);
    process.exit(1);
});
