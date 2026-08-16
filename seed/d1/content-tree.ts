/**
 * Where a content file sits, what that makes it, and which Container it is in.
 *
 * The rule is ADR 0004: the directory classifies, the front matter is checked
 * against it. Before this, `generate-seed-sql.ts` walked everything and
 * believed `type`, while `generate-kv-json.ts` looked only inside `blog/` — so
 * a Post filed under `bookmarks/` was seeded with no body rendered, and listed,
 * linked and indexed with an empty page while nothing failed.
 *
 * Phase 2a generalises it to trees that hold a Container. One tree can now hold
 * two types — `series/` holds the manifest *and* the Posts that are its Parts —
 * and what tells them apart is already in the path:
 *
 *     bookmarks/how-i-would-do-auth.md                   depth 1
 *     blog/<slug>/<slug>.en.md                           depth 2
 *     projects/<project>/<project>.en.md                 depth 2
 *     series/<series>/<series>.en.md                     depth 2
 *     series/<series>/<part>/<part>.en.md                depth 3
 *     projects/<project>/<note>/<note>.en.md              depth 3
 *
 * The file named after its folder *is* that folder; a subfolder is content
 * living inside it. So depth 1 and 2 are the tree's own item, and depth 3 is
 * content whose Container is the folder above.
 *
 * Pure, and shared by both generators: a classification with two
 * implementations has two chances to drift, which is the shape of the defect
 * this replaces.
 */

/** What a Markdown file can declare itself to be. */
export type ContentType = "post" | "link" | "project" | "series";

/**
 * The top-level directories under `app/content`: what each one holds, and what
 * — if anything — may live nested inside one of its items.
 *
 * `nested: null` means *nothing nests here*. A subfolder under `blog/` fails
 * the build rather than acquiring an invented meaning. `projects/` used to say
 * the same, before `project_slug` existed on `content` to make a nested Post
 * linkable — 1b (`evolution-plan/14-phase-1b-field-notes.md`) is the column's
 * arrival, and this line is the branch it was reserved for: depth 3 under a
 * Project is a Field Note, the same depth rule `series/` already generalised.
 */
export const CONTENT_TREES = {
  blog: { item: "post", nested: null },
  bookmarks: { item: "link", nested: null },
  projects: { item: "project", nested: "post" },
  series: { item: "series", nested: "post" },
} as const satisfies Record<string, { item: ContentType; nested: ContentType | null }>;

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
 * What the path says a file is: its tree, the type it must declare, and the
 * Container it lives in — the folder above, or `null` when it is not nested.
 */
export interface Placement {
  tree: ContentTree;
  type: ContentType;
  container: string | null;
}

/** A path that classifies as nothing, and the reason the build must stop. */
export type PlacementResult = Placement | { error: string };

export function isMisplaced(result: PlacementResult): result is { error: string } {
  return "error" in result;
}

/**
 * Reads a path relative to `app/content` into a placement.
 *
 * Every branch that returns an error is a file that would otherwise publish
 * nothing and say nothing, which is the one outcome ADR 0004 refuses to
 * tolerate.
 */
export function placementOf(relativePath: string): PlacementResult {
  const segments = pathSegments(relativePath);
  const [first, ...rest] = segments;

  if (rest.length === 0) {
    return {
      error: `${relativePath} sits loose at the root of app/content — nothing would read it and nothing would say so`,
    };
  }

  if (!(first in CONTENT_TREES)) {
    return {
      error: `${relativePath} is not under a content tree — nothing would read it and nothing would say so`,
    };
  }

  const tree = first as ContentTree;
  const { item, nested } = CONTENT_TREES[tree];

  // Depth 1 is a loose item — bookmarks are the only tree written that way —
  // and depth 2 is the folder-per-item convention every other tree follows.
  // Both are the tree's own item, so neither has a Container.
  if (rest.length <= 2) {
    return { tree, type: item, container: null };
  }

  if (rest.length === 3) {
    if (nested === null) {
      return {
        error: `${relativePath} is nested inside a ${item}, and nothing nests under ${tree}`,
      };
    }

    return { tree, type: nested, container: rest[0] };
  }

  return {
    error: `${relativePath} is nested deeper than a Container — the tree holds items, and items hold content, and that is all`,
  };
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
 *
 * Directory names only, which is what lets `tags.json` sit loose at the root of
 * `app/content` without being a fifth tree. It is not one: a tree holds Content
 * Items and that file holds none — it declares the Tags they may carry. So it is
 * read by name, not walked, and `placementOf` still refuses every *Markdown*
 * file at that level.
 */
export function unclaimedTrees(directoryNames: string[]): string[] {
  return directoryNames.filter((name) => !(name in CONTENT_TREES));
}

/**
 * Whether the front matter's `type` is the one its placement calls for.
 *
 * Takes `string | undefined` rather than the narrowed union on purpose: the
 * input is a YAML field, so at this boundary it can be anything, and a missing
 * one must fail rather than default to whatever the directory implies.
 */
export function declaredTypeMatches(
  declaredType: string | undefined,
  placement: Placement,
): boolean {
  return declaredType === placement.type;
}
