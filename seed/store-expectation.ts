/**
 * What the Markdown says the stores should hold, derived from placement.
 *
 * `verify-stores.ts` keeps the disk, `wrangler` and the console; this module
 * owns the decision — which Document belongs in which table, under which
 * identity — so that decision can be tested without either. ADR 0012 draws the
 * line this module keeps to: it shares the classification rules with the
 * generators (`placementOf`, `parseContentFilename`, `localeMatchesTree`),
 * which say what a Document *is*, and it never imports a row builder or reads
 * `seed.sql`, which say what a Document *becomes* — those are exactly what a
 * verifier exists to doubt.
 *
 * Until this module existed, the rule was `attributes.type` — the front
 * matter dispatch ADR 0004 removed from the generators three phases ago,
 * alive in the one place whose job was catching it. `attributes.type` is not
 * read here, at all: a Document's identity is read off its path, the same way
 * the generators decide it.
 */

import {
  basenameOf,
  isMisplaced,
  localeMatchesTree,
  pathSegments,
  placementOf,
} from "./d1/content-tree.ts";
import { parseContentFilename } from "./d1/seed-sql.ts";

/** A Markdown file, read but not yet decided: its path and its front matter. */
export interface DocumentInput {
  /** Relative to `app/content` — the same identity `placementOf` reads. */
  relativePath: string;
  /**
   * Untyped at this boundary, like every reader upstream of a build check: this
   * is YAML, so a stricter type here would be a claim about a file nobody has
   * checked. `type` is deliberately absent from this shape — this module never
   * reads it.
   */
  attributes: {
    tags?: unknown;
    sections?: Array<{ slug: string; parts?: string[] }>;
    /** A Project manifest's Field Notes, in the order its landing renders them. */
    notes?: unknown;
    draft?: unknown;
  };
}

/**
 * A Content Item's Container, as its placement and the manifest that lists it
 * say it should be — never both `seriesSlug` and `projectSlug` at once, the
 * same way `content.series_slug` and `content.project_slug` never both hold a
 * value (`schema.sql`).
 */
export interface ContainerColumns {
  seriesSlug: string | null;
  seriesSection: string | null;
  projectSlug: string | null;
  containerOrder: number | null;
}

/** What the Markdown says each table should hold, keyed by identity. */
export interface Expectation {
  content: Set<string>;
  contentTags: Set<string>;
  project: Set<string>;
  series: Set<string>;
  sections: Set<string>;
  /** A Content Item's identity → its expected Container columns. */
  containers: Map<string, ContainerColumns>;
}

/** A Content Item with no Container — a loose Post, a Bookmark. */
const NO_CONTAINER: ContainerColumns = {
  seriesSlug: null,
  seriesSection: null,
  projectSlug: null,
  containerOrder: null,
};

/** One table's presence comparison: what the Markdown expects against what a store holds. */
export interface PresenceFinding {
  noun: string;
  expectedCount: number;
  /** Expected identities absent from the store — what a prune exists to prevent. */
  missing: string[];
  /** Identities present in the store that no Markdown file backs. */
  extra: string[];
}

/**
 * One Container column that disagrees between what the Markdown expects and
 * what a store holds — named by the Content Item's identity and the column,
 * never as a missing/unexpected pair. A wrong `container_order` is one number
 * against another, not one long identifier missing and a different one
 * showing up unannounced.
 */
export interface ContainerFinding {
  identity: string;
  column: keyof ContainerColumns;
  stored: string | number | null;
  expected: string | number | null;
}

/** One `content_tag` row per Tag the file carries, keyed as the prune keys it. */
function addTags(tags: Set<string>, slug: string, lang: string, values: unknown) {
  for (const tag of Array.isArray(values) ? values : []) {
    tags.add(`${slug}:${lang}:${tag}`);
  }
}

/** Where a Part sits, as its Series manifest lists it: its Section and its position in that list. */
interface PartLocation {
  section: string;
  order: number;
}

/**
 * Every Part's and every Field Note's position, read raw off the manifests in
 * `documents` — an indexed iteration over the same array `series-sql.ts` and
 * `project-sql.ts` read, and nothing else (ADR 0012). Keyed by Container
 * folder, Locale and the Part's or Note's own Slug, because a manifest only
 * governs the Locale it is itself written in.
 */
function readManifestPlacements(documents: DocumentInput[]): {
  parts: Map<string, PartLocation>;
  notes: Map<string, number>;
} {
  const parts = new Map<string, PartLocation>();
  const notes = new Map<string, number>();

  for (const { relativePath, attributes } of documents) {
    const placed = placementOf(relativePath);

    if (isMisplaced(placed) || placed.container !== null) {
      continue;
    }

    const parsed = parseContentFilename(basenameOf(relativePath));

    if (!parsed || parsed.lang === null || !localeMatchesTree(placed.tree, parsed.lang)) {
      continue;
    }

    const folder = pathSegments(relativePath)[1];

    if (placed.type === "series") {
      for (const section of attributes.sections ?? []) {
        (section.parts ?? []).forEach((partSlug, order) => {
          parts.set(`${folder}:${parsed.lang}:${partSlug}`, { section: section.slug, order });
        });
      }
    } else if (placed.type === "project") {
      const noteSlugs = Array.isArray(attributes.notes) ? (attributes.notes as string[]) : [];

      noteSlugs.forEach((noteSlug, order) => {
        notes.set(`${folder}:${parsed.lang}:${noteSlug}`, order);
      });
    }
  }

  return { parts, notes };
}

/**
 * Derives what every table should hold from a set of Documents, classified by
 * placement rather than by what their front matter declares.
 */
export function expectationFrom(documents: DocumentInput[]): Expectation {
  const expectation: Expectation = {
    content: new Set<string>(),
    contentTags: new Set<string>(),
    project: new Set<string>(),
    series: new Set<string>(),
    sections: new Set<string>(),
    containers: new Map<string, ContainerColumns>(),
  };

  const manifestPlacements = readManifestPlacements(documents);

  for (const { relativePath, attributes } of documents) {
    // `draft: true` produces no row, of any type — mirrored leniently: this
    // module's job is comparing what publishes against what is stored, not
    // re-validating that the flag is a boolean, which the build already
    // refuses to seed from if it is not.
    if (attributes.draft === true) {
      continue;
    }

    const placed = placementOf(relativePath);

    if (isMisplaced(placed)) {
      continue;
    }

    const parsed = parseContentFilename(basenameOf(relativePath));

    if (!parsed) {
      continue;
    }

    const { slug, lang } = parsed;

    if (placed.type === "post") {
      // `lang === null` leads the condition so TypeScript narrows `lang` to
      // `string` below — the same reason `series-sql.ts` and `project-sql.ts`
      // write the check this way.
      if (lang === null || !localeMatchesTree(placed.tree, lang)) {
        continue;
      }

      expectation.content.add(`${slug}:${lang}`);
      addTags(expectation.contentTags, slug, lang, attributes.tags);

      if (placed.container === null) {
        expectation.containers.set(`${slug}:${lang}`, NO_CONTAINER);
      } else if (placed.tree === "series") {
        const location = manifestPlacements.parts.get(`${placed.container}:${lang}:${slug}`);

        expectation.containers.set(`${slug}:${lang}`, {
          ...NO_CONTAINER,
          seriesSlug: placed.container,
          seriesSection: location?.section ?? null,
          containerOrder: location?.order ?? null,
        });
      } else if (placed.tree === "projects") {
        const order = manifestPlacements.notes.get(`${placed.container}:${lang}:${slug}`);

        expectation.containers.set(`${slug}:${lang}`, {
          ...NO_CONTAINER,
          projectSlug: placed.container,
          containerOrder: order ?? null,
        });
      }
    } else if (placed.type === "link") {
      expectation.content.add(`${slug}:`);
      addTags(expectation.contentTags, slug, "", attributes.tags);
      expectation.containers.set(`${slug}:`, NO_CONTAINER);
    } else if (placed.type === "project") {
      // A Project is not a Content Item — no Published At, no place in the
      // Timeline — so it is its own set, keyed the same way `project-sql.ts`
      // keys the row it seeds.
      if (lang === null || !localeMatchesTree(placed.tree, lang)) {
        continue;
      }

      expectation.project.add(`${slug}:${lang}`);
    } else if (placed.type === "series") {
      if (lang === null || !localeMatchesTree(placed.tree, lang)) {
        continue;
      }

      expectation.series.add(`${slug}:${lang}`);

      // The sections are read straight off the manifest, not off the
      // generated SQL: a generator that dropped one would otherwise agree
      // with itself (ADR 0012).
      for (const section of attributes.sections ?? []) {
        expectation.sections.add(`${slug}:${lang}:${section.slug}`);
      }
    }
  }

  return expectation;
}

/**
 * Both directions, per table: a row the Markdown does not back is as wrong as
 * one it backs and the store is missing. The second is the one a prune exists
 * to prevent — a Section dropped from a manifest keeps rendering on the
 * landing until something notices it is still there.
 */
export function comparePresence(
  noun: string,
  expected: Set<string>,
  present: Set<string>,
): PresenceFinding {
  return {
    noun,
    expectedCount: expected.size,
    missing: [...expected].filter((key) => !present.has(key)),
    extra: [...present].filter((key) => !expected.has(key)),
  };
}

const CONTAINER_COLUMNS: (keyof ContainerColumns)[] = [
  "seriesSlug",
  "seriesSection",
  "projectSlug",
  "containerOrder",
];

/**
 * Column by column, for every identity the Markdown expects a Container
 * shape for: a Part's Series and Section, a Field Note's Project, either
 * one's position, or a loose Post's absence of all four (ADR 0012's "value on
 * a row that already exists").
 *
 * An identity missing from `present` is skipped, not reported here — the
 * presence comparison already names it missing, and reporting it again as
 * four disagreeing columns would say the same thing twice, in two shapes.
 */
export function compareContainers(
  expected: Map<string, ContainerColumns>,
  present: Map<string, ContainerColumns>,
): ContainerFinding[] {
  const findings: ContainerFinding[] = [];

  for (const [identity, expectedColumns] of expected) {
    const storedColumns = present.get(identity);

    if (!storedColumns) {
      continue;
    }

    for (const column of CONTAINER_COLUMNS) {
      if (storedColumns[column] !== expectedColumns[column]) {
        findings.push({
          identity,
          column,
          stored: storedColumns[column],
          expected: expectedColumns[column],
        });
      }
    }
  }

  return findings;
}
