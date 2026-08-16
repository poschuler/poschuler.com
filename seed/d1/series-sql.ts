/**
 * A Series manifest → the SQL that seeds `series` and `series_section`, and the
 * position of every Part it lists.
 *
 * Pure, like `seed-sql.ts` and `project-sql.ts`, and separate from both for the
 * reason a Series has its own tables: it is not a Content Item. It has no
 * Published At, never appears in the Timeline, and is revised in place as Parts
 * arrive.
 *
 * The manifest is authorship; D1 is a projection of it (ADR 0001). What the
 * manifest declares that nothing else could is the **arc**: which sections
 * exist, in which order, and which Parts each one holds. A Part does not know
 * where it is — see ADR 0007 — so the numbers below are written here, from the
 * position of a slug in a list, and never read from a Post's front matter.
 */

import { basenameOf, declaredTypeMatches, isMisplaced, placementOf } from "./content-tree.ts";
import { containerContradictionError, reconcileManifest } from "./manifest.ts";
import {
  draftError,
  escapeSql,
  isDraft,
  parseContentFilename,
  type InvalidFile,
  type PartPlacement,
  type SeededRow,
} from "./seed-sql.ts";

/** Editorial: whether the Destination has been reached. Never derived. */
const SERIES_STATUSES = ["ongoing", "complete"] as const;

/**
 * The only status a section may declare.
 *
 * *Planned* and *in progress* are already stated by the structure — a section
 * with no Parts is one, a section with Parts is the other — so declaring either
 * would restore two sources of truth free to disagree. Only *finished* cannot
 * be observed, because it is a promise the author holds.
 */
const SECTION_COMPLETE = "complete";

export interface SeriesSectionFrontMatter {
  slug: string;
  title: string;
  summary: string;
  /** Absent, or `complete`. Anything else fails the build. */
  status?: string;
  /** The Parts of this section, in reading order. Absent means planned. */
  parts?: string[];
}

/**
 * Every field typed as loosely as the file allows: this is YAML, so a stricter
 * type here would be a claim about a file nobody has checked. The checks below
 * are what turn it into a row.
 */
export interface SeriesFrontMatter {
  type: "series";
  title: string;
  description?: string;
  status: string;
  startingPoint: string;
  destination: string;
  outOfScope: unknown;
  audience: string;
  sections: unknown;
  /** `unknown` for the same reason as on a Post — see `draftError`. */
  draft?: unknown;
}

/** A Markdown file found under a Series folder, already parsed. */
export interface SeriesPartFile {
  /** The Slug, from the filename. */
  slug: string;
  lang: string;
  /** The folder it sits in — its own name, per the rule in `content-tree.ts`. */
  folder: string;
  relativePath: string;
  /**
   * Whether this Part's own front matter declares `draft: true`. Read leniently
   * here — the definitive check that the value is a boolean at all happens
   * where the Part's own row is built, in `contentRowFor` — because all this
   * needs is to tell a published Part from an unpublished one for the
   * Container-contradiction check below.
   */
  draft: boolean;
}

export interface SeriesRows {
  slug: string;
  lang: string;
  /** Keyed `slug:lang`. */
  series: SeededRow;
  /** Keyed `seriesSlug:lang:sectionSlug`. */
  sections: SeededRow[];
  /** Part Slug → where the manifest says it sits. */
  parts: Map<string, PartPlacement>;
  /**
   * Whether this manifest declared itself a Draft. `series` and `sections`
   * above are still built when it did — the caller decides whether to seed
   * them — because `parts` is needed either way: a drafted Container's Parts,
   * which must themselves be Drafts (see the Container-contradiction check),
   * still have to be listed and reconciled like any other.
   */
  draft: boolean;
}

export type SeriesResult = SeriesRows | InvalidFile;

export function isInvalidSeries(result: SeriesResult): result is InvalidFile {
  return "error" in result;
}

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The four halves of the contract, checked by name.
 *
 * The columns are `NOT NULL`, so the database would refuse the row anyway. What
 * this buys is the message: the file and the field that is missing, instead of
 * a constraint violation partway through seeding the deployed store.
 */
const CONTRACT_FIELDS = ["startingPoint", "destination", "audience"] as const;

function contractError(
  relativePath: string,
  attributes: SeriesFrontMatter,
): string | null {
  for (const field of CONTRACT_FIELDS) {
    if (!isFilledString(attributes[field])) {
      return `${relativePath} has no ${field} — a reader cannot tell whether the series is for them`;
    }
  }

  if (
    !Array.isArray(attributes.outOfScope) ||
    attributes.outOfScope.length === 0 ||
    !attributes.outOfScope.every(isFilledString)
  ) {
    return `${relativePath} has no outOfScope — what a series refuses to cover is half of what it promises`;
  }

  return null;
}

function sectionsError(
  relativePath: string,
  sections: SeriesSectionFrontMatter[],
): string | null {
  const seen = new Set<string>();

  for (const section of sections) {
    if (!isFilledString(section.slug) || !isFilledString(section.title)) {
      return `${relativePath} has a section with no slug or no title`;
    }

    if (seen.has(section.slug)) {
      return `${relativePath} lists the section '${section.slug}' twice`;
    }

    seen.add(section.slug);

    // Rendered on the landing whatever state the section is in, and read again
    // by the Part that closes a section to announce what comes next.
    if (!isFilledString(section.summary)) {
      return `${relativePath} section '${section.slug}' has no summary — the landing has nothing to show for it`;
    }

    if (section.status !== undefined && section.status !== SECTION_COMPLETE) {
      return `${relativePath} section '${section.slug}' declares status '${section.status}' — the only declarable value is '${SECTION_COMPLETE}'; planned and in-progress are read from whether it has Parts`;
    }

    if (section.status === SECTION_COMPLETE && (section.parts ?? []).length === 0) {
      return `${relativePath} section '${section.slug}' is marked ${SECTION_COMPLETE} with no Parts`;
    }
  }

  return null;
}

/**
 * Manifest and disk must reconcile: every listed Part has a file, and every
 * file under the Series folder is listed exactly once.
 *
 * This is the invariant that replaced two others — contiguous `order` and no
 * shared position — which stopped being representable the moment order became a
 * list. It catches the thing that actually happens: writing a Part and
 * forgetting to index it, which would publish a page nothing links to.
 *
 * The emptiness check stays here, because the message it produces names the
 * section — `manifest.ts`'s shared `reconcileManifest` takes over once every
 * entry is known to be a real Slug, and is where 1b's Project manifest
 * reconciles the same way (Part 8 of the field notes).
 */
function reconcileError(
  relativePath: string,
  sections: SeriesSectionFrontMatter[],
  partFiles: SeriesPartFile[],
): string | null {
  const entries: { slug: string; where: string }[] = [];

  for (const section of sections) {
    for (const slug of section.parts ?? []) {
      if (!isFilledString(slug)) {
        return `${relativePath} section '${section.slug}' lists an empty Part`;
      }

      entries.push({ slug, where: section.slug });
    }
  }

  return reconcileManifest(relativePath, entries, partFiles, "Part");
}

/**
 * The rows for one Series manifest, or the reason the build should stop.
 *
 * `partFiles` is every Markdown file under this Series folder that carries this
 * manifest's Locale and a recognised one at all. A draft filed under the
 * `.en-old.md` convention parses to no Locale, is never seeded, and so is not
 * reconciled against the manifest either — a draft declared with
 * `draft: true`, by contrast, is reconciled exactly like a published Part.
 */
export function seriesRowsFor(
  relativePath: string,
  attributes: SeriesFrontMatter,
  body: string,
  partFiles: SeriesPartFile[],
): SeriesResult {
  const placed = placementOf(relativePath);

  if (isMisplaced(placed)) {
    return { error: placed.error };
  }

  if (placed.type !== "series") {
    return { error: `${relativePath} is not a Series manifest` };
  }

  if (!declaredTypeMatches(attributes.type, placed)) {
    return {
      error: `${relativePath} declares type '${attributes.type}' but its position says 'series'`,
    };
  }

  const parsed = parseContentFilename(basenameOf(relativePath));

  if (!parsed) {
    return { error: `could not parse slug and lang from ${relativePath}` };
  }

  const { slug, lang } = parsed;

  // A Series landing has no `.en-old.md` convention to hide behind, as on a
  // Project: it is one page, revised in place, so a missing Locale is a
  // mistake. `draft: true` is the only way one goes unpublished.
  if (!lang) {
    return { error: `${relativePath} must have a language in its filename` };
  }

  const draftProblem = draftError(relativePath, attributes.draft);

  if (draftProblem) {
    return { error: draftProblem };
  }

  // The landing renders the contract, the sections and the Parts from data. The
  // body is the prose that says why the series exists, and it is required for
  // the same reason the contract fields are: optional means forgotten, and a
  // mute landing published with nothing failing.
  if (body.trim() === "") {
    return { error: `${relativePath} has no body — the landing would render a contract and no voice` };
  }

  if (!isFilledString(attributes.title)) {
    return { error: `${relativePath} has no title` };
  }

  if (!(SERIES_STATUSES as readonly string[]).includes(attributes.status)) {
    return {
      error: `${relativePath} has status '${attributes.status}' — expected one of ${SERIES_STATUSES.join(", ")}`,
    };
  }

  const contract = contractError(relativePath, attributes);

  if (contract) {
    return { error: contract };
  }

  if (!Array.isArray(attributes.sections) || attributes.sections.length === 0) {
    return { error: `${relativePath} declares no sections — a Series with no arc is a tag` };
  }

  const sections = attributes.sections as SeriesSectionFrontMatter[];
  const sectionProblem = sectionsError(relativePath, sections);

  if (sectionProblem) {
    return { error: sectionProblem };
  }

  const reconcile = reconcileError(relativePath, sections, partFiles);

  if (reconcile) {
    return { error: reconcile };
  }

  if (isDraft(attributes.draft)) {
    const contradiction = containerContradictionError(relativePath, partFiles);

    if (contradiction) {
      return { error: contradiction };
    }
  }

  const series: SeededRow = {
    statement: `
INSERT OR REPLACE INTO series (slug, lang, title, description, status, starting_point, destination, out_of_scope, audience, updated_at)
VALUES (${escapeSql(slug)}, ${escapeSql(lang)}, ${escapeSql(attributes.title)}, ${escapeSql(attributes.description)}, ${escapeSql(attributes.status)}, ${escapeSql(attributes.startingPoint)}, ${escapeSql(attributes.destination)}, ${escapeSql(JSON.stringify(attributes.outOfScope))}, ${escapeSql(attributes.audience)}, CURRENT_TIMESTAMP);
`,
    key: `${slug}:${lang}`,
  };

  const sectionRows: SeededRow[] = [];
  const parts = new Map<string, PartPlacement>();

  sections.forEach((section, index) => {
    sectionRows.push({
      statement: `
INSERT OR REPLACE INTO series_section (series_slug, lang, slug, title, summary, status, section_order, updated_at)
VALUES (${escapeSql(slug)}, ${escapeSql(lang)}, ${escapeSql(section.slug)}, ${escapeSql(section.title)}, ${escapeSql(section.summary)}, ${escapeSql(section.status)}, ${index}, CURRENT_TIMESTAMP);
`,
      key: `${slug}:${lang}:${section.slug}`,
    });

    (section.parts ?? []).forEach((partSlug, position) => {
      parts.set(partSlug, { seriesSlug: slug, section: section.slug, order: position });
    });
  });

  return { slug, lang, series, sections: sectionRows, parts, draft: isDraft(attributes.draft) };
}

/**
 * Inserts first, prune last, and nothing at all when there are no Series —
 * unless `anyFilesFound` says otherwise.
 *
 * Both prunes are needed and neither is optional: a section removed from a
 * manifest would otherwise stay alive in the database and keep rendering on the
 * landing — the same failure `content` and `project` already close.
 *
 * The guard on an empty list is `project-sql.ts`'s, for its reason: a repo with
 * no Series is an ordinary state, and a prune built from an empty list deletes
 * every row on the strength of finding nothing. And `anyFilesFound` is
 * `project-sql.ts`'s too, for the same reason: every Series this walk found
 * may have declared `draft: true`, in which case a previously published one
 * must still be pruned even though `seriesRows` came back empty.
 */
export function buildSeriesSeedSql(
  seriesRows: SeededRow[],
  sectionRows: SeededRow[],
  { anyFilesFound = false }: { anyFilesFound?: boolean } = {},
): string {
  if (seriesRows.length === 0 && !anyFilesFound) {
    return "";
  }

  const statements = [...seriesRows, ...sectionRows].map((row) => row.statement).join("");
  const seriesKeys = seriesRows.map((row) => escapeSql(row.key)).join(", ");
  const sectionKeys = sectionRows.map((row) => escapeSql(row.key)).join(", ");

  return `${statements}
DELETE FROM series WHERE slug || ':' || lang NOT IN (${seriesKeys});
DELETE FROM series_section WHERE series_slug || ':' || lang || ':' || slug NOT IN (${sectionKeys});
`;
}
