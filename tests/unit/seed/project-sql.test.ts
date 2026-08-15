import { describe, expect, it } from "vitest";

import { isInvalid, isSkipped, type SeededRow } from "../../../seed/d1/seed-sql";
import {
  buildProjectSeedSql,
  projectRowFor,
  type ProjectFrontMatter,
} from "../../../seed/d1/project-sql";

/**
 * A Project is not a Content Item — no Published At, no place in the Timeline —
 * so it has its own table and its own rules. What it shares with `content` is
 * the shape of the seed: upserts first, prune last, never a leading delete.
 */

const project = (overrides: Partial<ProjectFrontMatter> = {}): ProjectFrontMatter => ({
  type: "project",
  title: "Chekalo",
  summary: "Price intelligence across nine Peruvian retailers.",
  description: "A price intelligence platform.",
  tier: "flagship",
  status: "active",
  stack: ["TypeScript", "Node.js"],
  liveUrl: "https://chekalo.pe",
  sortOrder: 1,
  updates: [{ date: "2026-08-20", note: "First published." }],
  ...overrides,
});

describe("projectRowFor", () => {
  it("emits an upsert keyed by (Slug, Locale), with the slug from the filename", () => {
    const row = projectRowFor("projects/chekalo/chekalo.en.md", project()) as SeededRow;

    expect(row.key).toBe("chekalo:en");
    expect(row.statement).toContain("INSERT OR REPLACE INTO project");
    expect(row.statement).toContain("'chekalo', 'en'");
  });

  it("serialises the stack as JSON and an absent one as an empty array", () => {
    const withStack = projectRowFor("projects/a/a.en.md", project()) as SeededRow;
    const without = projectRowFor(
      "projects/a/a.en.md",
      project({ stack: undefined }),
    ) as SeededRow;

    expect(withStack.statement).toContain(`'["TypeScript","Node.js"]'`);
    expect(without.statement).toContain(`'[]'`);
  });

  it("defaults sort_order rather than letting it be null", () => {
    const row = projectRowFor(
      "projects/a/a.en.md",
      project({ sortOrder: undefined }),
    ) as SeededRow;

    expect(row.statement).toMatch(/, 0,/);
  });

  /**
   * A Project has no Published At, so its most recent revision is the only date
   * it has — and the sitemap needs one. An empty list would silently fall back
   * to the generic date for the whole site.
   */
  it("fails a Project with no revisions at all", () => {
    const result = projectRowFor("projects/a/a.en.md", project({ updates: [] }));

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/at least one/);
  });

  it("fails a Project whose language is not in its filename", () => {
    const result = projectRowFor("projects/a/a.md", project());

    expect(isSkipped(result) || isInvalid(result)).toBe(true);
  });

  it.each([
    ["tier", { tier: "featured" as never }, /tier/],
    ["status", { status: "live" as never }, /status/],
    ["summary", { summary: "  " }, /summary/],
  ])("fails an unusable %s", (_field, overrides, message) => {
    const result = projectRowFor("projects/a/a.en.md", project(overrides));

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(message);
  });

  /**
   * `experiment` is accepted by the schema from the first day even though
   * nothing is one — SQLite cannot alter a CHECK, so adding it later means
   * recreating the table by hand in production.
   */
  it("accepts experiment, which the schema allows before anything uses it", () => {
    const result = projectRowFor("projects/a/a.en.md", project({ tier: "experiment" }));

    expect(isInvalid(result)).toBe(false);
  });

  it("fails a file handed to it from outside the projects tree", () => {
    const result = projectRowFor("blog/a/a.en.md", project());

    expect(isInvalid(result)).toBe(true);
  });
});

/** A Project landing can be a Draft exactly like a Post can. */
describe("projectRowFor — Drafts", () => {
  it("skips a Project landing declaring itself a draft, after every other check has passed", () => {
    const result = projectRowFor("projects/chekalo/chekalo.en.md", project({ draft: true }));

    expect(isSkipped(result)).toBe(true);
    expect((result as { reason: string }).reason).toBe("projects/chekalo/chekalo.en.md is a draft");
  });

  it("still fails a draft Project for every reason a published one would", () => {
    const result = projectRowFor(
      "projects/chekalo/chekalo.en.md",
      project({ draft: true, tier: "featured" as never }),
    );

    expect(isInvalid(result)).toBe(true);
  });

  it("fails a non-boolean draft value rather than reading it as truthy", () => {
    const result = projectRowFor("projects/chekalo/chekalo.en.md", project({ draft: "true" as never }));

    expect(isInvalid(result)).toBe(true);
    expect((result as { error: string }).error).toMatch(/draft must be true or false/);
  });

  it("behaves exactly as today when the flag is absent", () => {
    const result = projectRowFor("projects/chekalo/chekalo.en.md", project());

    expect(isSkipped(result)).toBe(false);
    expect(isInvalid(result)).toBe(false);
  });

  /**
   * The round trip: the existing prune removes what the walk no longer hands
   * it. A second, always-published Project keeps the row list non-empty
   * throughout — `buildProjectSeedSql([])` is deliberately a no-op (see its
   * own tests below), so a lone Project's own draft round trip has to be
   * proven with company, the way the site is never down to zero Projects.
   */
  it("removes a previously published Project's row through the existing prune once it becomes a draft", () => {
    const chekalo = projectRowFor("projects/chekalo/chekalo.en.md", project()) as SeededRow;
    const other = projectRowFor(
      "projects/poschuler-com/poschuler-com.en.md",
      project({ sortOrder: 2 }),
    ) as SeededRow;

    const sqlWhilePublished = buildProjectSeedSql([chekalo, other]);
    expect(sqlWhilePublished).toContain(
      "DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'poschuler-com:en')",
    );

    const draftResult = projectRowFor("projects/chekalo/chekalo.en.md", project({ draft: true }));
    expect(isSkipped(draftResult)).toBe(true);

    // The generator's walk now hands only `other` to the builder — the same
    // keep-list mechanism, with chekalo's key excluded.
    const sqlAfterDraft = buildProjectSeedSql([other]);
    expect(sqlAfterDraft).toContain("DELETE FROM project WHERE slug || ':' || lang NOT IN ('poschuler-com:en')");
  });

  /**
   * `preview:drafts` (Part 3 of the field notes) — see the matching block in
   * `seed-sql.test.ts` for the reasoning.
   */
  describe("includeDrafts", () => {
    it("emits a row for a draft Project instead of skipping it", () => {
      const result = projectRowFor(
        "projects/chekalo/chekalo.en.md",
        project({ draft: true }),
        { includeDrafts: true },
      );

      expect(isSkipped(result)).toBe(false);
      expect(isInvalid(result)).toBe(false);
      expect((result as SeededRow).key).toBe("chekalo:en");
    });

    it("still skips a draft Project when the option is false", () => {
      const result = projectRowFor(
        "projects/chekalo/chekalo.en.md",
        project({ draft: true }),
        { includeDrafts: false },
      );

      expect(isSkipped(result)).toBe(true);
    });

    it("still fails a draft Project for every reason a published one would, drafts included", () => {
      const result = projectRowFor(
        "projects/chekalo/chekalo.en.md",
        project({ draft: true, tier: "featured" as never }),
        { includeDrafts: true },
      );

      expect(isInvalid(result)).toBe(true);
    });

    it("does not affect a published Project — the same row either way", () => {
      const withoutOption = projectRowFor("projects/chekalo/chekalo.en.md", project());
      const withOption = projectRowFor(
        "projects/chekalo/chekalo.en.md",
        project(),
        { includeDrafts: true },
      );

      expect((withoutOption as SeededRow).statement).toBe((withOption as SeededRow).statement);
    });
  });
});

describe("buildProjectSeedSql", () => {
  const rows = () =>
    [
      projectRowFor("projects/chekalo/chekalo.en.md", project()) as SeededRow,
      projectRowFor("projects/poschuler-com/poschuler-com.en.md", project()) as SeededRow,
    ] satisfies SeededRow[];

  it("puts every insert before the prune", () => {
    const sql = buildProjectSeedSql(rows());

    expect(sql.indexOf("INSERT OR REPLACE")).toBeLessThan(sql.indexOf("DELETE FROM project"));
  });

  it("prunes by identity, keeping every row a Markdown file still backs", () => {
    const sql = buildProjectSeedSql(rows());

    expect(sql).toContain(
      "DELETE FROM project WHERE slug || ':' || lang NOT IN ('chekalo:en', 'poschuler-com:en')",
    );
  });

  /**
   * Unlike `content`, an empty list is a real state here: Phase 1a ships before
   * any Project is written. It must not emit a prune that deletes everything on
   * the strength of an empty list.
   */
  it("emits nothing at all when there are no projects", () => {
    expect(buildProjectSeedSql([])).toBe("");
  });

  /**
   * The bug an empty list alone cannot rule out: the site's one Project going
   * draft looks identical, from `rows.length`, to no Project ever having been
   * written — unless the caller says otherwise. Without `anyFilesFound`, this
   * would leave a previously published Project's row live in D1 forever.
   */
  it("prunes everything when every Project the walk found is a draft", () => {
    const sql = buildProjectSeedSql([], { anyFilesFound: true });

    expect(sql).toContain("DELETE FROM project WHERE slug || ':' || lang NOT IN ()");
  });
});
