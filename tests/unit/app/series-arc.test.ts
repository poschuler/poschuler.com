import { describe, expect, it } from "vitest";

import {
  orientationFor,
  readingOrder,
  type ArcSection,
} from "../../../app/lib/series-arc";

/**
 * The orientation a reader gets around a Part, derived and nothing else.
 *
 * These are the edges the design turns on: the first Part has no previous, the
 * last one that exists has no next — and that second case is the one that
 * decides whether a series in progress reads as alive or as abandoned. Loading
 * a page by hand would exercise exactly the case that already works.
 */

const part = (slug: string, date = "2026-01-01") => ({
  slug,
  title: `The ${slug} part`,
  publishedStringDate: date,
});

const section = (
  slug: string,
  parts: ArcSection["parts"],
  status: ArcSection["status"] = null,
): ArcSection => ({
  slug,
  title: `The ${slug} section`,
  summary: `What ${slug} covers.`,
  status,
  parts,
});

/** Three published Parts, then a section nobody has started. */
const ARC: ArcSection[] = [
  section("fundamentals", [part("setup"), part("validation"), part("slices")]),
  section("persistence", []),
  section("correctness", []),
];

describe("readingOrder", () => {
  it("is one straight line: sections in order, Parts within each", () => {
    expect(readingOrder(ARC).map((entry) => entry.part.slug)).toEqual([
      "setup",
      "validation",
      "slices",
    ]);
  });

  it("skips a section with no Parts rather than leaving a hole", () => {
    const written = [
      section("fundamentals", [part("setup")]),
      section("persistence", []),
      section("correctness", [part("tests")]),
    ];

    expect(readingOrder(written).map((entry) => entry.part.slug)).toEqual(["setup", "tests"]);
  });
});

describe("orientationFor", () => {
  it("returns null for a Slug the arc does not hold", () => {
    expect(orientationFor(ARC, "not-a-part", "ongoing")).toBeNull();
  });

  it("places the reader in their section", () => {
    const orientation = orientationFor(ARC, "validation", "ongoing");

    expect(orientation?.part.slug).toBe("validation");
    expect(orientation?.section.slug).toBe("fundamentals");
  });

  it("gives the middle Part both neighbours, unnamed — they share its section", () => {
    const orientation = orientationFor(ARC, "validation", "ongoing");

    expect(orientation?.previous?.part.slug).toBe("setup");
    expect(orientation?.next?.part.slug).toBe("slices");
    expect(orientation?.previous?.sectionTitle).toBeNull();
    expect(orientation?.next?.sectionTitle).toBeNull();
  });

  /** The slot the landing fills — *start here, the full arc*. */
  it("leaves the first Part of the Series with no previous", () => {
    expect(orientationFor(ARC, "setup", "ongoing")?.previous).toBeNull();
  });

  it("names the section when a neighbour is in a different one", () => {
    const written = [
      section("fundamentals", [part("setup")]),
      section("persistence", [part("migrations")]),
    ];

    expect(orientationFor(written, "setup", "ongoing")?.next).toEqual({
      part: part("migrations"),
      sectionTitle: "The persistence section",
    });
    expect(orientationFor(written, "migrations", "ongoing")?.previous?.sectionTitle).toBe(
      "The fundamentals section",
    );
  });
});

/**
 * The end of what is published. The reader hits an empty `next` exactly when
 * they are most engaged, and what fills that slot is the difference between a
 * series in progress and one that was abandoned.
 */
describe("orientationFor — the end of what exists", () => {
  it("announces the next section that has nothing yet, with its summary", () => {
    const orientation = orientationFor(ARC, "slices", "ongoing");

    expect(orientation?.next).toBeNull();
    expect(orientation?.nextUp?.slug).toBe("persistence");
    expect(orientation?.nextUp?.summary).toBe("What persistence covers.");
    expect(orientation?.endOfSeries).toBe(false);
  });

  /**
   * Writing a later section first is unusual and legitimate, and nothing
   * enforces that the arc advances in order. What must not happen is
   * announcing a section whose Parts the reader was just offered.
   */
  it("skips a later section that already has Parts when announcing what is next", () => {
    const written = [
      section("fundamentals", [part("setup")]),
      section("persistence", []),
      section("correctness", [part("tests")]),
      section("operations", []),
    ];

    expect(orientationFor(written, "tests", "ongoing")?.nextUp?.slug).toBe("operations");
  });

  it("announces nothing when the last section is the last of the arc", () => {
    const written = [section("fundamentals", [part("setup")])];
    const orientation = orientationFor(written, "setup", "ongoing");

    expect(orientation?.next).toBeNull();
    expect(orientation?.nextUp).toBeNull();
    expect(orientation?.endOfSeries).toBe(false);
  });

  /** Only a Series that declares the Destination reached may say so. */
  it("calls it the end of the Series only when the Series says it is complete", () => {
    const written = [section("fundamentals", [part("setup")], "complete")];

    expect(orientationFor(written, "setup", "complete")?.endOfSeries).toBe(true);
    expect(orientationFor(written, "setup", "ongoing")?.endOfSeries).toBe(false);
  });

  /**
   * A section marked `complete` closes nothing on its own: the Series is what
   * ends, and the reader is sent on to whatever comes after it.
   */
  it("still announces the next section even when the current one is complete", () => {
    const written = [
      section("fundamentals", [part("setup")], "complete"),
      section("persistence", []),
    ];

    expect(orientationFor(written, "setup", "complete")?.nextUp?.slug).toBe("persistence");
    expect(orientationFor(written, "setup", "complete")?.endOfSeries).toBe(false);
  });
});
