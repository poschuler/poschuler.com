import { describe, expect, it } from "vitest";

import {
  CONTENT_TREES,
  declaredTypeMatchesTree,
  treeOf,
  unclaimedTrees,
  type ContentTree,
} from "../../../seed/d1/content-tree";

/**
 * The rule from ADR 0004: the tree a file sits in decides what it is, and the
 * `type` in its front matter is checked against that rather than believed.
 *
 * Worth testing rather than reading, because the failure it replaces was
 * silent — a Post filed under `bookmarks/` was seeded by D1 and rendered by
 * neither, listing and indexing with an empty page.
 */

describe("treeOf", () => {
  it.each([
    ["blog/value-objects/value-objects.en.md", "blog"],
    ["bookmarks/how-i-would-do-auth.md", "bookmarks"],
    ["projects/chekalo/chekalo.en.md", "projects"],
  ])("reads %s as the %s tree", (relativePath, tree) => {
    expect(treeOf(relativePath)).toBe(tree);
  });

  /**
   * The generators run on Linux in CI and on WSL here, but the rule must not
   * depend on that: a path is split on either separator.
   */
  it("reads a Windows-style path the same way", () => {
    expect(treeOf("blog\\value-objects\\value-objects.en.md")).toBe("blog");
  });

  /**
   * The failure this guards is not misclassification, it is invisibility: a
   * file under a directory no generator claims produces nothing and says
   * nothing. The caller turns this null into a failed build.
   */
  it("returns null for a top-level directory no generator claims", () => {
    expect(treeOf("drafts/something.en.md")).toBeNull();
  });

  it("returns null for a file sitting loose at the root of the content directory", () => {
    expect(treeOf("stray.en.md")).toBeNull();
  });

  it("names a tree for every type the generators can seed", () => {
    expect(Object.keys(CONTENT_TREES).sort()).toEqual(["blog", "bookmarks", "projects"]);
  });
});

describe("unclaimedTrees", () => {
  it("names nothing when every directory is walked by someone", () => {
    expect(unclaimedTrees(["blog", "bookmarks", "projects"])).toEqual([]);
  });

  /**
   * The generators turn this into a failed build. Without it, a `drafts/`
   * directory publishes nothing and reports nothing, which reads as success.
   */
  it("names a directory no generator walks", () => {
    expect(unclaimedTrees(["blog", "drafts"])).toEqual(["drafts"]);
  });
});

describe("declaredTypeMatchesTree", () => {
  it.each([
    ["post", "blog"],
    ["link", "bookmarks"],
    ["project", "projects"],
  ])("accepts type %s in the %s tree", (type, tree) => {
    expect(declaredTypeMatchesTree(type, tree as ContentTree)).toBe(true);
  });

  /** The exact case that used to pass in silence. */
  it("rejects a Post filed under bookmarks", () => {
    expect(declaredTypeMatchesTree("post", "bookmarks")).toBe(false);
  });

  it("rejects a type no tree declares", () => {
    expect(declaredTypeMatchesTree("note", "blog")).toBe(false);
  });

  it("rejects a missing type rather than assuming the tree is right", () => {
    expect(declaredTypeMatchesTree(undefined, "blog")).toBe(false);
  });
});
