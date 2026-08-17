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
 *
 * A placement `placementOf` cannot classify, and a filename carrying no
 * recognised Locale under a tree that requires one, throw rather than being
 * skipped: both are things a Document *is*, and a Document that yields no
 * expectation is indistinguishable from one that is correct once all that is
 * left is a set comparison. A Draft, and a `draft` that is not a boolean, are
 * still skipped quietly — those are things a Document *says*, and the build
 * already owns them (#58, ADR 0012).
 */

import {
  basenameOf,
  isMisplaced,
  localeMatchesTree,
  pathSegments,
  placementOf,
  type ContentTree,
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
  /** A Series Section's identity → its expected position in the manifest's arc. */
  sectionOrder: Map<string, number>;
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

/**
 * The message a Post, a Project landing or a Series manifest fails the
 * verification with when its filename carries no recognised Locale under a
 * tree that requires one — one wording, shared by every branch that checks
 * it, rather than three copies free to drift apart (#58).
 */
function noRecognisedLocale(relativePath: string, tree: ContentTree): string {
  return `${relativePath} carries no recognised Locale — a file under ${tree}/ must end in .en.md or .es.md`;
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
    sectionOrder: new Map<string, number>(),
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

    // A placement `placementOf` cannot classify is a thing a Document *is*,
    // read off its path — not something the build already owns, the way a
    // Draft is. Skipping it would make it indistinguishable from a Document
    // that is correct: comparing sets finds nothing wrong either way. This is
    // the one invocation with nothing earlier catching it (`remote` measures
    // the deployed store, and nothing guarantees the checkout that runs this
    // is the one that seeded it), so it stops the run rather than being
    // absorbed (#58, ADR 0012).
    if (isMisplaced(placed)) {
      throw new Error(placed.error);
    }

    const parsed = parseContentFilename(basenameOf(relativePath));

    if (!parsed) {
      continue;
    }

    const { slug, lang } = parsed;

    if (placed.type === "post") {
      // `lang === null` leads the condition so TypeScript narrows `lang` to
      // `string` below — the same reason `series-sql.ts` and `project-sql.ts`
      // write the check this way. A filename carrying no recognised Locale
      // under a tree that requires one is the same fatal shape as a
      // placement that will not classify — it is what the file *is*, not
      // what it *says* — so it stops the run too (#58).
      if (lang === null || !localeMatchesTree(placed.tree, lang)) {
        throw new Error(noRecognisedLocale(relativePath, placed.tree));
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
      // keys the row it seeds. No recognised Locale is fatal here too (#58).
      if (lang === null || !localeMatchesTree(placed.tree, lang)) {
        throw new Error(noRecognisedLocale(relativePath, placed.tree));
      }

      expectation.project.add(`${slug}:${lang}`);
    } else if (placed.type === "series") {
      if (lang === null || !localeMatchesTree(placed.tree, lang)) {
        throw new Error(noRecognisedLocale(relativePath, placed.tree));
      }

      expectation.series.add(`${slug}:${lang}`);

      // The sections, and each one's position in the arc, are read straight
      // off the manifest's own array — an indexed iteration and nothing else
      // — not off the generated SQL: a generator that dropped one, or wrote
      // it at the wrong position, would otherwise agree with itself
      // (ADR 0012).
      (attributes.sections ?? []).forEach((section, index) => {
        const identity = `${slug}:${lang}:${section.slug}`;

        expectation.sections.add(identity);
        expectation.sectionOrder.set(identity, index);
      });
    }
  }

  return expectation;
}

/**
 * Whether the Content Item expectation derived to nothing — the one state
 * `generate-seed-sql.ts` already treats as impossible (`buildSeedSql`'s own
 * guard against an empty walk emptying the live table): comparing two empty
 * sets finds nothing wrong in either direction, so a broken derivation — a
 * path constant that moves, a directory read that fails quietly — would
 * otherwise certify an empty store as correct. Scoped to Content Items alone:
 * a Project, a Series and a Series Section may legitimately be absent, since
 * the schema ships before the first one is written (#58).
 */
export function isEmptyContentExpectation(expectation: Expectation): boolean {
  return expectation.content.size === 0;
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

/**
 * One Series Section whose stored position disagrees with the index its
 * manifest lists it at — named by the Section's identity and both positions,
 * the same reasoning as `ContainerFinding`: a wrong position is one number
 * against another, not a missing row plus an unexpected one.
 */
export interface SectionOrderFinding {
  identity: string;
  stored: number;
  expected: number;
}

/**
 * The Container comparison's reasoning applied one level up: a Series
 * Section's own position in the arc is a value on a row that already
 * exists, not a presence set. An identity missing from `present` is skipped
 * here too — the presence comparison for Sections already names it missing.
 */
export function compareSectionOrder(
  expected: Map<string, number>,
  present: Map<string, number>,
): SectionOrderFinding[] {
  const findings: SectionOrderFinding[] = [];

  for (const [identity, expectedOrder] of expected) {
    const storedOrder = present.get(identity);

    if (storedOrder === undefined || storedOrder === expectedOrder) {
      continue;
    }

    findings.push({ identity, stored: storedOrder, expected: expectedOrder });
  }

  return findings;
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
