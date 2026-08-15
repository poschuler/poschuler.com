/**
 * A Series' arc — its sections and the Parts inside them — and the orientation
 * a reader standing on one Part is owed.
 *
 * Pure, and separate from `series.server.ts` for two reasons. The queries
 * belong to the model, but *what a reader sees around the article* is a rule
 * with edges — the first Part, the last one that exists, a section that closes
 * onto one nobody has written yet — and those are the cases worth a test rather
 * than a page loaded by hand.
 *
 * Everything here is derived. Nothing counts, nothing predicts: the arc lists
 * what exists, and a denominator would be a claim about the future.
 */

/** A Part as the arc knows it: enough to list it and link to it. */
export interface ArcPart {
  slug: string;
  title: string;
  /** Already truncated to `YYYY-MM-DD` by the query. */
  publishedStringDate: string;
}

export interface ArcSection {
  slug: string;
  title: string;
  summary: string;
  /**
   * `complete` when the author has closed it, `null` otherwise. *Planned* and
   * *in progress* are not stored: a section with no Parts is one, a section
   * with Parts is the other — see ADR 0007.
   */
  status: "complete" | null;
  /** In reading order, from the manifest's list. Empty means planned. */
  parts: ArcPart[];
}

/**
 * A neighbouring Part, with the section it belongs to named **only when it is
 * not the reader's own**. Reading order is one straight line and crosses
 * section boundaries; a link that crosses one without saying so reads as the
 * next article in the same section.
 */
export interface PartLink {
  part: ArcPart;
  sectionTitle: string | null;
}

export interface Orientation {
  /** The Part the reader is on, and the section it sits in. */
  part: ArcPart;
  section: ArcSection;
  /** `null` on the first Part of the whole Series — that slot holds the landing. */
  previous: PartLink | null;
  /** `null` at the end of what is published, which is the case that matters. */
  next: PartLink | null;
  /**
   * The section announced when there is no next Part: the one the reader would
   * have gone on to, using the title and summary the manifest already carries
   * for the landing. Never a list of unwritten Parts — those do not exist.
   */
  nextUp: ArcSection | null;
  /** Nothing follows and the Series declares the Destination reached. */
  endOfSeries: boolean;
}

/** Every Part in reading order: sections in manifest order, Parts within each. */
export function readingOrder(sections: ArcSection[]): Array<{ part: ArcPart; section: ArcSection }> {
  return sections.flatMap((section) => section.parts.map((part) => ({ part, section })));
}

/**
 * Where `partSlug` sits in the arc, or `null` when the arc does not hold it —
 * which the route turns into a 404 rather than a page with an empty frame.
 */
export function orientationFor(
  sections: ArcSection[],
  partSlug: string,
  seriesStatus: "ongoing" | "complete",
): Orientation | null {
  const order = readingOrder(sections);
  const index = order.findIndex((entry) => entry.part.slug === partSlug);

  if (index === -1) {
    return null;
  }

  const { part, section } = order[index];

  const link = (at: number): PartLink | null => {
    const entry = order[at];

    if (!entry) {
      return null;
    }

    return {
      part: entry.part,
      sectionTitle: entry.section.slug === section.slug ? null : entry.section.title,
    };
  };

  const next = link(index + 1);

  /**
   * Only asked when nothing follows. Written as *the first later section with
   * no Parts* rather than *the next section*, so that an arc where a later
   * section was written first still announces something a reader can wait for
   * instead of one they have already been offered.
   */
  const nextUp =
    next === null
      ? (sections
          .slice(sections.findIndex((candidate) => candidate.slug === section.slug) + 1)
          .find((candidate) => candidate.parts.length === 0) ?? null)
      : null;

  return {
    part,
    section,
    previous: link(index - 1),
    next,
    nextUp,
    endOfSeries: next === null && nextUp === null && seriesStatus === "complete",
  };
}
