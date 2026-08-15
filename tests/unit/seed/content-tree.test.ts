import { describe, expect, it } from "vitest";

import {
  CONTENT_TREES,
  declaredTypeMatches,
  isMisplaced,
  placementOf,
  treeOf,
  unclaimedTrees,
  type Placement,
} from "../../../seed/d1/content-tree";

/**
 * The rule from ADR 0004: the tree a file sits in decides what it is, and the
 * `type` in its front matter is checked against that rather than believed.
 * Phase 2a adds the second half — how deep it sits decides whether it is the
 * tree's own item or content inside a Container.
 *
 * Worth testing rather than reading, because the failure it replaces was
 * silent — a Post filed under `bookmarks/` was seeded by D1 and rendered by
 * neither, listing and indexing with an empty page.
 */

const placement = (relativePath: string): Placement => {
  const result = placementOf(relativePath);

  if (isMisplaced(result)) {
    throw new Error(`expected a placement for ${relativePath}, got: ${result.error}`);
  }

  return result;
};

describe("treeOf", () => {
  it.each([
    ["blog/value-objects/value-objects.en.md", "blog"],
    ["bookmarks/how-i-would-do-auth.md", "bookmarks"],
    ["projects/chekalo/chekalo.en.md", "projects"],
    ["series/api/api.en.md", "series"],
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
    expect(Object.keys(CONTENT_TREES).sort()).toEqual(["blog", "bookmarks", "projects", "series"]);
  });
});

describe("placementOf — the tree's own item", () => {
  it.each([
    ["bookmarks/how-i-would-do-auth.md", "bookmarks", "link"],
    ["blog/value-objects/value-objects.en.md", "blog", "post"],
    ["projects/chekalo/chekalo.en.md", "projects", "project"],
    ["series/pragmatic-nodejs-api/pragmatic-nodejs-api.en.md", "series", "series"],
  ])("reads %s as a %s item of type %s", (relativePath, tree, type) => {
    expect(placement(relativePath)).toEqual({ tree, type, container: null });
  });

  /** A loose Bookmark and a foldered Post are both their tree's own item. */
  it("does not distinguish a loose file from a foldered one", () => {
    expect(placement("bookmarks/a.md").type).toBe(placement("bookmarks/a/a.md").type);
  });
});

describe("placementOf — content inside a Container", () => {
  /**
   * The whole point of the depth rule: one tree, two types, told apart by the
   * path rather than by a filename convention the walker would have to learn
   * twice.
   */
  it("reads a Part as a Post whose Container is the folder above", () => {
    expect(placement("series/pragmatic-nodejs-api/project-setup/project-setup.en.md")).toEqual({
      tree: "series",
      type: "post",
      container: "pragmatic-nodejs-api",
    });
  });

  it("reads a Windows-style nested path the same way", () => {
    expect(placement("series\\api\\part-one\\part-one.en.md").container).toBe("api");
  });

  /**
   * `nested: null` means nothing nests here. Without this a subfolder under
   * `blog/` would acquire an invented meaning instead of failing.
   */
  it("fails a subfolder under a tree that holds no Container", () => {
    const result = placementOf("blog/value-objects/aside/aside.en.md");

    expect(isMisplaced(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/nothing nests under blog/);
  });

  /**
   * Field Notes are 1b, and they need a `project_slug` on `content` to be
   * linkable. Accepting one today would seed a Post with no Container.
   */
  it("fails a Field Note under a Project, which arrives in 1b", () => {
    const result = placementOf("projects/chekalo/a-field-note/a-field-note.en.md");

    expect(isMisplaced(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/nothing nests under projects/);
  });

  it("fails anything nested deeper than a Container", () => {
    const result = placementOf("series/api/part-one/deeper/deeper.en.md");

    expect(isMisplaced(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/deeper than a Container/);
  });
});

describe("placementOf — what classifies as nothing", () => {
  it("fails a file under a directory no generator claims", () => {
    const result = placementOf("drafts/something.en.md");

    expect(isMisplaced(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/not under a content tree/);
  });

  it("fails a file sitting loose at the root of the content directory", () => {
    const result = placementOf("stray.en.md");

    expect(isMisplaced(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/loose at the root/);
  });
});

describe("unclaimedTrees", () => {
  it("names nothing when every directory is walked by someone", () => {
    expect(unclaimedTrees(["blog", "bookmarks", "projects", "series"])).toEqual([]);
  });

  /**
   * The generators turn this into a failed build. Without it, a `drafts/`
   * directory publishes nothing and reports nothing, which reads as success.
   */
  it("names a directory no generator walks", () => {
    expect(unclaimedTrees(["blog", "drafts"])).toEqual(["drafts"]);
  });
});

describe("declaredTypeMatches", () => {
  it.each([
    ["post", "blog/a/a.en.md"],
    ["link", "bookmarks/a.md"],
    ["project", "projects/a/a.en.md"],
    ["series", "series/a/a.en.md"],
    ["post", "series/a/part/part.en.md"],
  ])("accepts type %s at %s", (type, relativePath) => {
    expect(declaredTypeMatches(type, placement(relativePath))).toBe(true);
  });

  /** The exact case that used to pass in silence. */
  it("rejects a Post filed under bookmarks", () => {
    expect(declaredTypeMatches("post", placement("bookmarks/a.md"))).toBe(false);
  });

  /** Depth, not just the tree: a manifest and a Part sit in the same tree. */
  it("rejects a Part declaring itself the Series it belongs to", () => {
    expect(declaredTypeMatches("series", placement("series/a/part/part.en.md"))).toBe(false);
  });

  it("rejects a type no tree declares", () => {
    expect(declaredTypeMatches("note", placement("blog/a/a.en.md"))).toBe(false);
  });

  it("rejects a missing type rather than assuming the tree is right", () => {
    expect(declaredTypeMatches(undefined, placement("blog/a/a.en.md"))).toBe(false);
  });
});
