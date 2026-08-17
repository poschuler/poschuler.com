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

import { basenameOf, isMisplaced, localeMatchesTree, placementOf } from "./d1/content-tree.ts";
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
    sections?: Array<{ slug: string }>;
    draft?: unknown;
  };
}

/** What the Markdown says each table should hold, keyed by identity. */
export interface Expectation {
  content: Set<string>;
  contentTags: Set<string>;
  project: Set<string>;
  series: Set<string>;
  sections: Set<string>;
}

/** One table's presence comparison: what the Markdown expects against what a store holds. */
export interface PresenceFinding {
  noun: string;
  expectedCount: number;
  /** Expected identities absent from the store — what a prune exists to prevent. */
  missing: string[];
  /** Identities present in the store that no Markdown file backs. */
  extra: string[];
}

/** One `content_tag` row per Tag the file carries, keyed as the prune keys it. */
function addTags(tags: Set<string>, slug: string, lang: string, values: unknown) {
  for (const tag of Array.isArray(values) ? values : []) {
    tags.add(`${slug}:${lang}:${tag}`);
  }
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
  };

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
    } else if (placed.type === "link") {
      expectation.content.add(`${slug}:`);
      addTags(expectation.contentTags, slug, "", attributes.tags);
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
