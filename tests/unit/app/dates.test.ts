import { describe, expect, it } from "vitest";

import { formatPostDate } from "~/lib/dates";

/**
 * `toLocaleDateString` under the hood, so what this checks is the one thing
 * that call can get wrong here: that the Locale given actually changes the
 * order the date renders in. `en` and `es` disagree on that order, which is
 * what a Spanish page rendering an American date looks like when it regresses.
 */
describe("formatPostDate", () => {
  it("orders an English date month before day", () => {
    expect(formatPostDate("2026-06-15", "en")).toBe(new Date("2026-06-15").toLocaleDateString("en"));
    expect(formatPostDate("2026-06-15", "en")).toMatch(/^6\/1[45]\/2026$/);
  });

  it("orders a Spanish date day before month", () => {
    expect(formatPostDate("2026-06-15", "es")).toBe(new Date("2026-06-15").toLocaleDateString("es"));
    expect(formatPostDate("2026-06-15", "es")).toMatch(/^1[45]\/6\/2026$/);
  });

  it("disagrees between the two Locales for the same date", () => {
    expect(formatPostDate("2026-06-15", "en")).not.toBe(formatPostDate("2026-06-15", "es"));
  });
});
