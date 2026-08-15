/**
 * What the author says changed about a document, and when.
 *
 * ADR 0005: a curated list in the content itself, newest first, stored as JSON
 * in one column. There is no separate "last updated" field — the most recent
 * revision is the first element, so the two cannot drift.
 *
 * Lives under `app/lib` because both sides need the same shape: the seed
 * generators validate front matter into the column, and the routes read the
 * column back out.
 */

export type Revision = {
  /** `YYYY-MM-DD`, the form every editorial date in this repository takes. */
  date: string;
  /** One line, in the author's voice, about what a returning reader should know. */
  note: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RevisionsResult = { revisions: Revision[] } | { error: string };

/**
 * Front matter → the list that will be stored, or the reason the build should
 * stop.
 *
 * Strict on purpose. This list is the only record of when a document last
 * changed — `updated_at` is stamped by every seed and says nothing editorial —
 * so a malformed entry that degraded to an empty list would silently date the
 * page by its publication and nobody would notice.
 */
export function validateRevisions(input: unknown): RevisionsResult {
  if (input === undefined || input === null) {
    return { revisions: [] };
  }

  if (!Array.isArray(input)) {
    return { error: "updates must be a list of { date, note }" };
  }

  const revisions: Revision[] = [];

  for (const [index, entry] of input.entries()) {
    const at = `updates[${index}]`;

    if (typeof entry !== "object" || entry === null) {
      return { error: `${at} must be an object with a date and a note` };
    }

    const { date, note } = entry as Partial<Revision>;

    if (typeof date !== "string" || date.trim() === "") {
      return { error: `${at} has no date` };
    }

    if (!ISO_DATE.test(date)) {
      return { error: `${at} has the date "${date}", which is not YYYY-MM-DD` };
    }

    if (typeof note !== "string" || note.trim() === "") {
      return { error: `${at} has no note — a date alone does not tell a reader whether to re-read` };
    }

    revisions.push({ date, note: note.trim() });
  }

  // Sorted here rather than trusted from the file. The template renders the
  // first element as the current state, so a file listing oldest-first would
  // publish a stale note under the title — and it would look right in review.
  return { revisions: [...revisions].sort((a, b) => b.date.localeCompare(a.date)) };
}

/**
 * The stored column → the list, tolerantly.
 *
 * Deliberately the opposite of `validateRevisions`: the build is where a
 * malformed list is caught, and by the time a row is being rendered a page with
 * no revision line beats no page at all.
 */
export function parseRevisions(json: string): Revision[] {
  try {
    const result = validateRevisions(JSON.parse(json));
    return "revisions" in result ? result.revisions : [];
  } catch {
    return [];
  }
}

/** The current state of the document, or `null` if it has never been revised. */
export function latestRevision(revisions: Revision[]): Revision | null {
  return revisions[0] ?? null;
}
