import { describe, expect, it } from "vitest";

import {
  comparePresence,
  expectationFrom,
  type DocumentInput,
} from "../../../seed/store-expectation";

/**
 * ADR 0012: the verifier stops deciding what a Document is by reading its
 * front matter, and starts classifying by placement — the same rule the
 * generators use (ADR 0004). This is the module the decision now lives in,
 * pure and shared, so it can be tested without a database and without
 * `wrangler`.
 *
 * The failure this replaces was silent: `verify-stores.ts` used to dispatch on
 * `attributes.type`, which had no branch for `project`, so a wrong prune of a
 * Project passed the Publication without a word. Placement has no such gap —
 * `attributes.type` is not read here, at all.
 */

const document = (
  relativePath: string,
  attributes: Record<string, unknown> = {},
): DocumentInput => ({ relativePath, attributes: attributes as DocumentInput["attributes"] });

describe("expectationFrom — classifies by placement, not by declared type", () => {
  it("expects a Post at (Slug, Locale) whatever its front matter declares itself to be", () => {
    const docs = [document("blog/value-objects/value-objects.en.md", { type: "note" })];

    expect(expectationFrom(docs).content).toEqual(new Set(["value-objects:en"]));
  });

  it("expects a Bookmark keyed with no Locale", () => {
    const docs = [document("bookmarks/how-i-would-do-auth.md")];

    expect(expectationFrom(docs).content).toEqual(new Set(["how-i-would-do-auth:"]));
  });
});

describe("expectationFrom — Tags", () => {
  it("keys a Tag row to the Content Item plus the Tag", () => {
    const docs = [
      document("blog/value-objects/value-objects.en.md", { tags: ["nodejs", "typescript"] }),
    ];

    expect(expectationFrom(docs).contentTags).toEqual(
      new Set(["value-objects:en:nodejs", "value-objects:en:typescript"]),
    );
  });
});

describe("expectationFrom — a Series and its Sections", () => {
  it("expects the Series and every Section its manifest lists, keyed by position in the file", () => {
    const docs = [
      document("series/pragmatic-nodejs-api/pragmatic-nodejs-api.en.md", {
        sections: [{ slug: "fundamentals" }, { slug: "persistence" }],
      }),
    ];

    const expectation = expectationFrom(docs);

    expect(expectation.series).toEqual(new Set(["pragmatic-nodejs-api:en"]));
    expect(expectation.sections).toEqual(
      new Set(["pragmatic-nodejs-api:en:fundamentals", "pragmatic-nodejs-api:en:persistence"]),
    );
  });
});

describe("expectationFrom — Drafts", () => {
  it("expects nothing for a Document declaring draft: true", () => {
    const docs = [document("blog/value-objects/value-objects.en.md", { draft: true })];

    expect(expectationFrom(docs).content.size).toBe(0);
  });

  /**
   * A malformed `draft` is the build's mistake to catch, not this module's —
   * ADR 0012 draws the line here: leniency survives for content states, only
   * a placement that will not classify is fatal, and it is a later ticket
   * that makes that fatal, not this one.
   */
  it("expects a Document whose draft value is not a boolean, rather than re-validating it", () => {
    const docs = [document("blog/value-objects/value-objects.en.md", { draft: "true" })];

    expect(expectationFrom(docs).content).toEqual(new Set(["value-objects:en"]));
  });
});

describe("expectationFrom — a Field Note, nested the same way a Part is", () => {
  it("expects a Field Note the same way it expects a loose Post", () => {
    const docs = [document("projects/chekalo/product-matching/product-matching.en.md")];

    expect(expectationFrom(docs).content).toEqual(new Set(["product-matching:en"]));
  });
});

describe("expectationFrom — placement and Locale", () => {
  it("expects nothing for a path that will not classify", () => {
    const docs = [document("drafts/something.en.md")];

    expect(expectationFrom(docs).content.size).toBe(0);
  });

  it("expects nothing for a Post with no recognised Locale under a tree that requires one", () => {
    const docs = [document("blog/no-locale/no-locale.md")];

    expect(expectationFrom(docs).content.size).toBe(0);
  });

  it("expects nothing for a Series manifest with no recognised Locale", () => {
    const docs = [
      document("series/api/api.md", { sections: [{ slug: "fundamentals" }] }),
    ];

    const expectation = expectationFrom(docs);

    expect(expectation.series.size).toBe(0);
    expect(expectation.sections.size).toBe(0);
  });

  /**
   * The exact gap ADR 0012 opens with: `type: 'project'` had no branch at all
   * in the old dispatch, so the `project` table was never compared. This
   * ticket does not close that gap — it is #55 — but a Project landing must
   * not accidentally classify as a Content Item or a Series either.
   */
  it("expects nothing at all for a Project landing — the project table has no expectation here yet", () => {
    const docs = [document("projects/chekalo/chekalo.en.md")];

    const expectation = expectationFrom(docs);

    expect(expectation.content.size).toBe(0);
    expect(expectation.series.size).toBe(0);
  });
});

describe("comparePresence", () => {
  it("names what the Markdown expects that the store is missing", () => {
    const finding = comparePresence("Content Item", new Set(["a:en", "b:en"]), new Set(["a:en"]));

    expect(finding).toEqual({ noun: "Content Item", expectedCount: 2, missing: ["b:en"], extra: [] });
  });

  it("names what the store holds that no Markdown file backs — the row a prune exists to remove", () => {
    const finding = comparePresence("Content Item", new Set(["a:en"]), new Set(["a:en", "orphan:en"]));

    expect(finding).toEqual({ noun: "Content Item", expectedCount: 1, missing: [], extra: ["orphan:en"] });
  });

  it("finds nothing wrong when expected and present agree", () => {
    const finding = comparePresence("Content Item", new Set(["a:en"]), new Set(["a:en"]));

    expect(finding.missing).toEqual([]);
    expect(finding.extra).toEqual([]);
  });
});
