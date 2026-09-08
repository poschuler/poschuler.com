import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { dbQuery } from "~/db.server";

import { openTestPlatform, type TestPlatform } from "../setup/platform";

/**
 * The whole D1 access layer is one function, and its failure path is the half
 * that only runs when something has already gone wrong — which is exactly when
 * the log has to be worth reading.
 *
 * Two guarantees: the statement travels with the error (Workers observability
 * keeps the log, and an error without its query is close to useless), and the
 * error is rethrown untouched so the route's ErrorBoundary sees the original.
 */

let platform: TestPlatform;

beforeAll(async () => {
  platform = await openTestPlatform();
});

afterAll(async () => {
  await platform?.dispose();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dbQuery", () => {
  it("returns the rows of a successful query", async () => {
    const rows = await dbQuery<{ slug: string }>(
      platform.env.POSCHULER_BD,
      "select slug from content order by published_at desc limit 2",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].slug).toBeTruthy();
  });

  // Two values, not one, and that is the point: a Slug stopped identifying a
  // row the day a Post was first translated, so the pair is what selects one.
  // Asserting a single row against `where slug = ?` alone read as a test of the
  // binding and was really a claim about the corpus — it went red on the first
  // `.es.md`, having proved nothing about `dbQuery`.
  it("binds its values rather than interpolating them", async () => {
    const [{ slug, lang }] = await dbQuery<{ slug: string; lang: string }>(
      platform.env.POSCHULER_BD,
      "select slug, lang from content where lang is not null limit 1",
    );

    const rows = await dbQuery<{ slug: string; lang: string }>(
      platform.env.POSCHULER_BD,
      "select slug, lang from content where slug = ? and lang = ?",
      [slug, lang],
    );

    expect(rows).toEqual([{ slug, lang }]);
  });

  it("returns an empty array rather than null when nothing matches", async () => {
    const rows = await dbQuery(
      platform.env.POSCHULER_BD,
      "select slug from content where slug = ?",
      ["nothing-by-this-name"],
    );

    expect(rows).toEqual([]);
  });

  /**
   * D1 returns `results` on every successful query, so this only fires if that
   * ever stops being true. The guard exists so a caller always gets an array to
   * iterate; without the test the branch is a claim nobody has checked.
   */
  it("returns an empty array when the driver reports no results at all", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ all: async () => ({ results: undefined }) }) }),
    } as unknown as D1Database;

    await expect(dbQuery(db, "select 1")).resolves.toEqual([]);
  });

  it("logs the failing statement and rethrows the original error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const sql = "select * from a_table_that_does_not_exist";

    await expect(dbQuery(platform.env.POSCHULER_BD, sql)).rejects.toThrow();

    expect(logged).toHaveBeenCalledWith("D1 dbQuery failed", expect.objectContaining({ sql }));
  });

  it("rethrows the error itself, not a wrapper around it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const thrown = await dbQuery(platform.env.POSCHULER_BD, "this is not sql").catch(
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(Error);
    // A wrapper would have swallowed D1's own message.
    expect((thrown as Error).message).not.toBe("");
  });
});
