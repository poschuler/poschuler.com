/**
 * The URLs this site published and no longer serves.
 *
 * **These entries are permanent and have no expiry.** They are not here for a
 * search engine, which does update its index — they are here for links already
 * published, which never do. Removing one in two years as tidying breaks
 * whatever still points at it, and nothing will report that it happened.
 *
 * One exception, and it is the only one: **an entry leaves when its
 * destination is retired**, because a redirect to a retired address is worse
 * than none. Three entries left the table that way, when the pages they pointed at were retired.
 *
 * Two rules the table has to keep, both checked in `redirects.test.ts`:
 *
 * - **Straight to the final destination, never chained.** A redirect aimed at
 *   an address that itself redirects costs a second round trip and loses
 *   authority at every hop.
 * - **A destination must exist.** A 301 pointing at a 404 is worse than no
 *   redirect at all — the reader gets nothing and the engine drops the URL
 *   rather than moving it. That one crosses this map and the database, so it is
 *   asserted in `tests/integration/redirects.test.ts`.
 */
export const PERMANENT_REDIRECTS: Record<string, string> = {
  // `resume` is a Spanish word — the third person singular of
  // *resumir* — so `/es/resume` would read as a conjugated verb rather than
  // as a CV. The route moved to `/cv` in both Locales (ADR 0010); the visible
  // navigation label stays *resume* in English, because the label and the
  // path are independent.
  "/resume": "/cv",
  "/resume.pdf": "/cv.pdf",

  // A Tag is its own URL, so renaming one moves a page. `ddd` was an acronym
  // that only resolves for a reader who already knows the subject, which is
  // the opposite of what a Tag is for; the vocabulary now spells it out.
  "/tags/ddd": "/tags/domain-driven-design",
};

/**
 * The path a request should be sent to, or `null` to let it through.
 *
 * A trailing slash is normalised away before the lookup: `/blog/x/` and
 * `/blog/x` were always the same document, and a hand-written or
 * mail-client-normalised link is exactly the kind of link this table exists
 * for. The root is left alone — stripping its slash would leave an empty path.
 *
 * The query string is carried through. It is what tells the author the
 * redirect is being used at all; dropping it makes the move invisible in
 * analytics on the day it matters most.
 */
export function resolveRedirect(url: URL): string | null {
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const destination = PERMANENT_REDIRECTS[pathname];

  if (!destination) {
    return null;
  }

  return destination + url.search;
}
