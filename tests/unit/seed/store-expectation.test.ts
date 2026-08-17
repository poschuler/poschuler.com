import { describe, expect, it } from "vitest";

import {
  compareContainers,
  comparePresence,
  compareSectionOrder,
  expectationFrom,
  isEmptyContentExpectation,
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

describe("expectationFrom — a Series Section's position in the arc", () => {
  it("expects a Section's position to be the index its manifest lists it at", () => {
    const docs = [
      document("series/pragmatic-nodejs-api/pragmatic-nodejs-api.en.md", {
        sections: [{ slug: "fundamentals" }, { slug: "persistence" }],
      }),
    ];

    expect(
      expectationFrom(docs).sectionOrder.get("pragmatic-nodejs-api:en:persistence"),
    ).toBe(1);
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
  /**
   * #58: a Document that yields no expectation used to be indistinguishable
   * from one that is correct — comparing sets makes nothing-against-nothing
   * pass forever. A placement `placementOf` cannot classify is a thing a
   * Document *is*, read off its path, so it now stops the run rather than
   * being skipped — naming the file and the reason, the same shape
   * `generate-seed-sql.ts` already fails the build with.
   */
  it("fails on a Document whose placement will not classify, naming the file and the reason", () => {
    const docs = [document("drafts/something.en.md")];

    expect(() => expectationFrom(docs)).toThrow(
      "drafts/something.en.md is not under a content tree — nothing would read it and nothing would say so",
    );
  });

  it("fails on a Post with no recognised Locale under a tree that requires one, naming the file", () => {
    const docs = [document("blog/no-locale/no-locale.md")];

    expect(() => expectationFrom(docs)).toThrow(/blog\/no-locale\/no-locale\.md/);
  });

  it("fails on a Series manifest with no recognised Locale, naming the file", () => {
    const docs = [
      document("series/api/api.md", { sections: [{ slug: "fundamentals" }] }),
    ];

    expect(() => expectationFrom(docs)).toThrow(/series\/api\/api\.md/);
  });

  it("fails on a Project landing with no recognised Locale, naming the file", () => {
    const docs = [document("projects/chekalo/chekalo.md")];

    expect(() => expectationFrom(docs)).toThrow(/projects\/chekalo\/chekalo\.md/);
  });

  /**
   * A Project landing must not accidentally classify as a Content Item or a
   * Series — it is neither: no Published At, no place in the Timeline.
   */
  it("expects a Project landing in the project set, not as a Content Item or a Series", () => {
    const docs = [document("projects/chekalo/chekalo.en.md")];

    const expectation = expectationFrom(docs);

    expect(expectation.project).toEqual(new Set(["chekalo:en"]));
    expect(expectation.content.size).toBe(0);
    expect(expectation.series.size).toBe(0);
  });
});

describe("expectationFrom — a Project", () => {
  /**
   * The exact gap #52 opens with: `type: 'project'` had no branch at all in
   * the old dispatch, so the `project` table was never compared. This is the
   * branch that closes it.
   */
  it("expects a Project at (Slug, Locale), keyed the same way project-sql.ts keys the row", () => {
    const docs = [document("projects/chekalo/chekalo.en.md")];

    expect(expectationFrom(docs).project).toEqual(new Set(["chekalo:en"]));
  });

  it("expects nothing for a Project manifest declaring itself a Draft", () => {
    const docs = [document("projects/chekalo/chekalo.en.md", { draft: true })];

    expect(expectationFrom(docs).project.size).toBe(0);
  });
});

describe("comparePresence — the project table, both directions", () => {
  /**
   * The observable outcome #52 built the acceptance around: a wrong prune of
   * `project` used to pass a Publication in silence, because the old dispatch
   * had no branch for it at all. `comparePresence` is what names the row that
   * went missing — the same function every other table already uses, now fed
   * from the `project` set.
   */
  it("names a Project the Markdown backs that a prune dropped from the table", () => {
    const docs = [
      document("projects/chekalo/chekalo.en.md"),
      document("projects/poschuler-com/poschuler-com.en.md"),
    ];

    const expected = expectationFrom(docs).project;
    const present = new Set(["chekalo:en"]);

    expect(comparePresence("Project", expected, present)).toEqual({
      noun: "Project",
      expectedCount: 2,
      missing: ["poschuler-com:en"],
      extra: [],
    });
  });

  it("names a row in the table that no Project manifest backs", () => {
    const docs = [document("projects/chekalo/chekalo.en.md")];

    const expected = expectationFrom(docs).project;
    const present = new Set(["chekalo:en", "retired-project:en"]);

    expect(comparePresence("Project", expected, present)).toEqual({
      noun: "Project",
      expectedCount: 1,
      missing: [],
      extra: ["retired-project:en"],
    });
  });
});

/**
 * #56: the Container columns on `content` — `series_slug`, `series_section`,
 * `project_slug` and `container_order` — join the expectation. Presence is a
 * set difference; a Container is a value on a row that already exists, so it
 * gets its own comparison keyed by identity rather than widening `content`
 * (ADR 0012, and the ticket's own reasoning for why widening was rejected).
 */
describe("expectationFrom — the Container columns", () => {
  it("expects a loose Post to have no Container", () => {
    const docs = [document("blog/value-objects/value-objects.en.md")];

    expect(expectationFrom(docs).containers.get("value-objects:en")).toEqual({
      seriesSlug: null,
      seriesSection: null,
      projectSlug: null,
      containerOrder: null,
    });
  });

  it("expects a Part's Series to be the Series it sits under, as its placement says", () => {
    const docs = [
      document(
        "series/pragmatic-nodejs-api/project-setup/project-setup.en.md",
      ),
    ];

    expect(expectationFrom(docs).containers.get("project-setup:en")?.seriesSlug).toBe(
      "pragmatic-nodejs-api",
    );
  });

  it("expects a Field Note's Project to be the Project it sits under, as its placement says", () => {
    const docs = [document("projects/chekalo/product-matching/product-matching.en.md")];

    expect(expectationFrom(docs).containers.get("product-matching:en")?.projectSlug).toBe(
      "chekalo",
    );
  });

  it("expects a Part's Series Section to be the Section that lists it in the manifest", () => {
    const docs = [
      document("series/pragmatic-nodejs-api/pragmatic-nodejs-api.en.md", {
        sections: [
          { slug: "fundamentals", parts: ["project-setup"] },
          { slug: "persistence", parts: ["repositories"] },
        ],
      }),
      document("series/pragmatic-nodejs-api/repositories/repositories.en.md"),
    ];

    expect(expectationFrom(docs).containers.get("repositories:en")?.seriesSection).toBe(
      "persistence",
    );
  });

  it("expects a Part's position to be the index its Section's manifest lists it at", () => {
    const docs = [
      document("series/pragmatic-nodejs-api/pragmatic-nodejs-api.en.md", {
        sections: [
          { slug: "fundamentals", parts: ["project-setup", "schema-validation", "vertical-slices"] },
        ],
      }),
      document("series/pragmatic-nodejs-api/vertical-slices/vertical-slices.en.md"),
    ];

    expect(expectationFrom(docs).containers.get("vertical-slices:en")?.containerOrder).toBe(2);
  });

  it("expects a Field Note's position to be the index its Project's manifest lists it at", () => {
    const docs = [
      document("projects/chekalo/chekalo.en.md", {
        notes: ["product-matching", "onboarding-flow"],
      }),
      document("projects/chekalo/onboarding-flow/onboarding-flow.en.md"),
    ];

    expect(expectationFrom(docs).containers.get("onboarding-flow:en")?.containerOrder).toBe(1);
  });

  /**
   * Settles #56's own review, where the Spec axis called this a gap and the
   * Tests axis called the suite sound: the loose-Post test above covers the
   * same empty-Container shape, but a Bookmark reaches it through a different
   * branch and under a different identity — Slug with an empty Locale, not
   * Slug with a Locale. Asserting the identity, not only the columns, is what
   * catches a mis-keyed entry rather than only a missing one.
   */
  it("expects a Bookmark to have no Container, keyed by its Slug with an empty Locale", () => {
    const docs = [document("bookmarks/how-i-would-do-auth.md")];

    expect(expectationFrom(docs).containers.get("how-i-would-do-auth:")).toEqual({
      seriesSlug: null,
      seriesSection: null,
      projectSlug: null,
      containerOrder: null,
    });
  });
});

/**
 * The comparison ADR 0012 says a Container needs and presence does not give:
 * a value on a row that already exists, named by column rather than reported
 * as one missing item plus one unexpected item — two long identifiers to diff
 * by eye (the ticket's own reasoning for rejecting a widened `content` key).
 */
describe("compareContainers", () => {
  it("names a Container column that disagrees, with the identity, the column, the stored value and the expected value", () => {
    const expected = new Map([
      [
        "repositories:en",
        { seriesSlug: "pragmatic-nodejs-api", seriesSection: "persistence", projectSlug: null, containerOrder: 1 },
      ],
    ]);
    const present = new Map([
      [
        "repositories:en",
        { seriesSlug: "pragmatic-nodejs-api", seriesSection: "fundamentals", projectSlug: null, containerOrder: 1 },
      ],
    ]);

    expect(compareContainers(expected, present)).toEqual([
      { identity: "repositories:en", column: "seriesSection", stored: "fundamentals", expected: "persistence" },
    ]);
  });

  it("fails a row that claims a Container for a Content Item the Markdown expects loose", () => {
    const expected = new Map([
      ["value-objects:en", { seriesSlug: null, seriesSection: null, projectSlug: null, containerOrder: null }],
    ]);
    const present = new Map([
      [
        "value-objects:en",
        { seriesSlug: "pragmatic-nodejs-api", seriesSection: "fundamentals", projectSlug: null, containerOrder: 0 },
      ],
    ]);

    expect(compareContainers(expected, present)).toEqual([
      { identity: "value-objects:en", column: "seriesSlug", stored: "pragmatic-nodejs-api", expected: null },
      { identity: "value-objects:en", column: "seriesSection", stored: "fundamentals", expected: null },
      { identity: "value-objects:en", column: "containerOrder", stored: 0, expected: null },
    ]);
  });

  it("finds nothing wrong when every column agrees", () => {
    const columns = { seriesSlug: "pragmatic-nodejs-api", seriesSection: "fundamentals", projectSlug: null, containerOrder: 0 };
    const expected = new Map([["project-setup:en", columns]]);
    const present = new Map([["project-setup:en", { ...columns }]]);

    expect(compareContainers(expected, present)).toEqual([]);
  });

  it("skips an identity the store has no row for — the presence comparison already names it missing", () => {
    const expected = new Map([
      ["repositories:en", { seriesSlug: "pragmatic-nodejs-api", seriesSection: "persistence", projectSlug: null, containerOrder: 1 }],
    ]);

    expect(compareContainers(expected, new Map())).toEqual([]);
  });
});

/**
 * #57: symmetric to #56 at one level up — a Series Section's own position in
 * the arc, derived from its index in the manifest's `sections` array, gets
 * the same kind of comparison a Part's `container_order` already has: a value
 * on a row that already exists, named by the Section's identity and both
 * positions rather than as a missing/unexpected pair.
 */
describe("compareSectionOrder", () => {
  it("names a Section whose stored position disagrees with the manifest's, with its identity and both positions", () => {
    const expected = new Map([["pragmatic-nodejs-api:en:persistence", 1]]);
    const present = new Map([["pragmatic-nodejs-api:en:persistence", 0]]);

    expect(compareSectionOrder(expected, present)).toEqual([
      { identity: "pragmatic-nodejs-api:en:persistence", stored: 0, expected: 1 },
    ]);
  });

  it("finds nothing wrong when the stored position agrees with the manifest's", () => {
    const expected = new Map([["pragmatic-nodejs-api:en:persistence", 1]]);
    const present = new Map([["pragmatic-nodejs-api:en:persistence", 1]]);

    expect(compareSectionOrder(expected, present)).toEqual([]);
  });

  it("skips a Section the store has no row for — the presence comparison already names it missing", () => {
    const expected = new Map([["pragmatic-nodejs-api:en:persistence", 1]]);

    expect(compareSectionOrder(expected, new Map())).toEqual([]);
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

/**
 * #58: comparing two sets makes nothing-against-nothing pass forever, so a
 * broken derivation — a path constant that moves, a directory read that fails
 * quietly — would certify an empty store as correct. `generate-seed-sql.ts`
 * already treats an empty walk as impossible (`buildSeedSql`'s own guard);
 * the verifier now agrees, for Content Items alone.
 */
describe("isEmptyContentExpectation", () => {
  it("is true when nothing expects a Content Item", () => {
    expect(isEmptyContentExpectation(expectationFrom([]))).toBe(true);
  });

  it("is false once at least one Content Item is expected", () => {
    const docs = [document("blog/value-objects/value-objects.en.md")];

    expect(isEmptyContentExpectation(expectationFrom(docs))).toBe(false);
  });
});

/**
 * The floor #58 refuses to generalise: a Project, a Series and a Series
 * Section may legitimately be absent — the schema ships before the first one
 * is written, and that was the normal state until two phases ago. Claiming a
 * floor there would be a false alarm waiting for someone to delete content on
 * purpose.
 */
describe("comparePresence — an empty expectation for Project, Series or Series Section stays legal", () => {
  it.each(["Project", "Series", "Series Section"])(
    "finds nothing wrong when both %s sides are empty",
    (noun) => {
      expect(comparePresence(noun, new Set(), new Set())).toEqual({
        noun,
        expectedCount: 0,
        missing: [],
        extra: [],
      });
    },
  );
});
