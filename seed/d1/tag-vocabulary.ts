/**
 * The Tags this site may use, and the two mistakes a Tag can be.
 *
 * A Tag *is* its Slug: the front matter carries lower-case kebab-case, and that
 * same string is the URL and the label a reader sees. Nothing is derived, so two
 * spellings of one subject cannot quietly resolve to one page — they fail here
 * instead.
 *
 * A rule about shape is not enough on its own. `architecture` and
 * `software-architecture` are both well-formed slugs, and they produced two
 * pages holding one Post each where there should have been one holding two. So
 * the set is *closed*: it is declared in `app/content/tags.json`, beside the
 * content and not in the pipeline, because which subjects this site writes about
 * is an editorial decision — the same kind the Series manifest already makes
 * about its own arc.
 *
 * Pure, like every other rule under `seed/d1`: the file is read from disk by
 * `generate-seed-sql.ts` and arrives here as a value.
 */

/**
 * Where the vocabulary is declared. Named in every message, because a build that
 * fails on a Tag should need no investigation to fix.
 */
export const TAG_VOCABULARY_FILE = "app/content/tags.json";

/**
 * Lower-case kebab-case, and nothing else: no leading, trailing or doubled
 * hyphen, because each of those is a distinct string that renders identically to
 * the one beside it and would be a second word for the same subject.
 */
const TAG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The declared Tags. A Set because every use of it is a membership test. */
export type TagVocabulary = ReadonlySet<string>;

export type TagVocabularyResult = { vocabulary: TagVocabulary } | { error: string };

export function isMalformedVocabulary(
  result: TagVocabularyResult,
): result is { error: string } {
  return "error" in result;
}

/**
 * The parsed contents of `tags.json` → the set the checks are made against, or
 * the reason the build stops.
 *
 * `unknown` because the input is a JSON file nobody has checked. The declaration
 * is held to the rule it exists to enforce: a `Nodejs` in there would declare
 * the mistake rather than catch it, and a Tag listed twice has stopped being a
 * decision about what may be written.
 */
export function tagVocabularyFrom(declared: unknown): TagVocabularyResult {
  if (!Array.isArray(declared)) {
    return { error: `${TAG_VOCABULARY_FILE} must be a JSON array of Tag slugs` };
  }

  const vocabulary = new Set<string>();

  for (const entry of declared) {
    if (typeof entry !== "string" || !TAG_SLUG.test(entry)) {
      return {
        error: `${TAG_VOCABULARY_FILE} declares ${JSON.stringify(entry)}, which is not a slug — a Tag is written in lower-case kebab-case`,
      };
    }

    if (vocabulary.has(entry)) {
      return { error: `${TAG_VOCABULARY_FILE} declares '${entry}' twice — one subject, one Tag` };
    }

    vocabulary.add(entry);
  }

  return { vocabulary };
}

/**
 * Every Tag on one Post or Bookmark, measured against the vocabulary.
 *
 * The shape is reported before the membership, and that ordering is the point:
 * `Nodejs` is undeclared *and* not a slug, and being told it is undeclared would
 * invite declaring it. They are different mistakes — one is fixed by rewriting
 * the Tag, the other by deciding this site covers a new subject — so the author
 * is told which one was made.
 *
 * `tags` is `unknown` for the reason the vocabulary is: it comes out of YAML, so
 * a stricter type here would be a claim about a file nobody has checked.
 */
export function tagError(
  relativePath: string,
  tags: unknown,
  vocabulary: TagVocabulary,
): string | null {
  if (tags === undefined || tags === null) {
    return null;
  }

  if (!Array.isArray(tags)) {
    return `${relativePath} writes tags as ${JSON.stringify(tags)} — tags is a list of Tags`;
  }

  for (const tag of tags) {
    if (typeof tag !== "string" || !TAG_SLUG.test(tag)) {
      return `${relativePath} carries the Tag ${JSON.stringify(tag)}, which is not a slug — a Tag is written in lower-case kebab-case, and that same string is its URL`;
    }

    if (!vocabulary.has(tag)) {
      return `${relativePath} carries the Tag '${tag}', which ${TAG_VOCABULARY_FILE} does not declare — declare it there, or use the Tag this site already has for that subject`;
    }
  }

  return null;
}
