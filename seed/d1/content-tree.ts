/**
 * Which tree a content file sits in, and whether it declares the type that tree
 * holds.
 *
 * The rule is ADR 0004: the directory classifies, the front matter is checked
 * against it. Before this, `generate-seed-sql.ts` walked everything and
 * believed `type`, while `generate-kv-json.ts` looked only inside `blog/` — so
 * a Post filed under `bookmarks/` was seeded with no body rendered, and listed,
 * linked and indexed with an empty page while nothing failed.
 *
 * Pure, and shared by both generators: a classification with two
 * implementations has two chances to drift, which is the shape of the defect
 * this replaces. It is also what a nested container would be read from, since a
 * file's parent directory is already in the path this receives.
 */

/** The top-level directories under `app/content`, and what each one holds. */
export const CONTENT_TREES = {
  blog: "post",
  bookmarks: "link",
  projects: "project",
} as const;

export type ContentTree = keyof typeof CONTENT_TREES;

/**
 * A path split on either separator, so nothing here depends on the platform the
 * generator happens to run on — the same content must produce the same
 * `seed.sql` everywhere, because CI compares it against the committed file byte
 * for byte.
 *
 * Exported because every reader of a content path needs the same split, and
 * four copies of one regular expression is four chances to normalise
 * differently.
 */
export function pathSegments(relativePath: string): string[] {
  return relativePath.split(/[\\/]/);
}

/** The filename at the end of a path — where a Slug comes from. */
export function basenameOf(relativePath: string): string {
  const segments = pathSegments(relativePath);
  return segments[segments.length - 1];
}

/**
 * The tree a path belongs to, or `null` when its top-level directory is not one
 * this repository claims.
 *
 * `null` is not "skip me". A file nothing claims is invisible rather than
 * misfiled — it produces no row, no body and no warning — so the callers turn
 * this into a failed build.
 */
export function treeOf(relativePath: string): ContentTree | null {
  const [first, ...rest] = pathSegments(relativePath);

  if (rest.length === 0) {
    return null;
  }

  return first in CONTENT_TREES ? (first as ContentTree) : null;
}

/**
 * The top-level directories no generator walks.
 *
 * The one check no per-file rule can make, and the reason it exists: a file
 * under a directory nobody walks is not misclassified, it is invisible —
 * producing no row, no body and no warning, which reads exactly like success.
 *
 * Takes the names rather than reading the directory so the rule stays testable
 * and stays here, beside the trees it is checking against.
 */
export function unclaimedTrees(directoryNames: string[]): string[] {
  return directoryNames.filter((name) => !(name in CONTENT_TREES));
}

/**
 * Whether the front matter's `type` is the one its tree holds.
 *
 * Takes `string | undefined` rather than the narrowed union on purpose: the
 * input is a YAML field, so at this boundary it can be anything, and a missing
 * one must fail rather than default to whatever the directory implies.
 */
export function declaredTypeMatchesTree(
  declaredType: string | undefined,
  tree: ContentTree,
): boolean {
  return declaredType === CONTENT_TREES[tree];
}
