import { describe, expect, it } from "vitest";

import {
  latestRevision,
  parseRevisions,
  validateRevisions,
  type Revision,
} from "../../../app/lib/revisions";

/**
 * ADR 0005. The list is the only record of when a document last changed —
 * `updated_at` moves on every seed — so a malformed one must fail the build
 * rather than quietly become an empty list and date the page by its
 * publication.
 */

const revision = (date: string, note = "Something changed."): Revision => ({ date, note });

describe("validateRevisions", () => {
  it("accepts an absent list, because most Posts never get revised", () => {
    expect(validateRevisions(undefined)).toEqual({ revisions: [] });
  });

  it("keeps the date and the note of each entry", () => {
    const result = validateRevisions([{ date: "2026-11-02", note: "Replaced the validation." }]);

    expect(result).toEqual({
      revisions: [{ date: "2026-11-02", note: "Replaced the validation." }],
    });
  });

  /**
   * Sorted here rather than trusted from the file. The template shows the first
   * element as the current state, so an author listing oldest-first would
   * publish a stale note under the title and never see it in review.
   */
  it("orders newest first regardless of how the file listed them", () => {
    const result = validateRevisions([revision("2026-01-01"), revision("2027-08-14")]);

    expect("revisions" in result && result.revisions.map((r) => r.date)).toEqual([
      "2027-08-14",
      "2026-01-01",
    ]);
  });

  it.each([
    [[{ note: "No date." }], /date/],
    [[{ date: "2026-11-02" }], /note/],
    [[{ date: "yesterday", note: "Not a date." }], /YYYY-MM-DD/],
    [[{ date: "2026-11-02", note: "   " }], /note/],
    ["2026-11-02", /list/],
  ])("rejects %j", (input, message) => {
    const result = validateRevisions(input);

    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toMatch(message);
  });
});

describe("parseRevisions", () => {
  it("reads back what the column stores", () => {
    expect(parseRevisions('[{"date":"2027-08-14","note":"Updated for Node 24."}]')).toEqual([
      { date: "2027-08-14", note: "Updated for Node 24." },
    ]);
  });

  /**
   * The column is `NOT NULL DEFAULT '[]'`, so an empty list is the normal case
   * and must not need a guard at every call site.
   */
  it("reads the default as an empty list", () => {
    expect(parseRevisions("[]")).toEqual([]);
  });

  /**
   * A render must not 500 over a malformed column. The build is where a bad
   * list is caught; by the time a row is being read, the page is better off
   * showing no revision than no page.
   */
  it("reads unparseable content as an empty list rather than throwing", () => {
    expect(parseRevisions("not json")).toEqual([]);
    expect(parseRevisions("")).toEqual([]);
  });
});

describe("latestRevision", () => {
  it("is the first element, so there is no second field to contradict it", () => {
    expect(latestRevision([revision("2027-08-14"), revision("2026-01-01")])).toEqual(
      revision("2027-08-14"),
    );
  });

  it("is null when nothing has been revised", () => {
    expect(latestRevision([])).toBeNull();
  });
});
