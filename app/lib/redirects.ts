/**
 * The URLs this site published and no longer serves.
 *
 * **These entries are permanent and have no expiry.** They are not here for a
 * search engine, which does update its index — they are here for links already
 * published, which never do. Removing one in two years as tidying breaks
 * whatever still points at it, and nothing will report that it happened.
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
 *
 * This is not where a Part's short Slug is resolved. `/blog/project-setup`
 * never existed publicly; it is answered in the `/blog/:blogSlug` loader,
 * derived from the row's Container, because that is a fact about the content
 * rather than a fact about history.
 */
export const PERMANENT_REDIRECTS: Record<string, string> = {
  // Phase 2a. The three Parts of Pragmatic Node.js API were published under
  // `/blog` with the Series name written by hand into each Slug, because
  // nothing yet read the directory a file sat in. They now live under their
  // Container, and the Slug says only what the Part is about.
  "/blog/pragmatic-nodejs-api-setup-nodejs-express-typescript-project":
    "/series/pragmatic-nodejs-api/project-setup",
  "/blog/pragmatic-nodejs-api-schema-validation-and-global-error-handling":
    "/series/pragmatic-nodejs-api/schema-validation-and-error-handling",
  "/blog/pragmatic-nodejs-api-vertical-slices-and-domain-logic":
    "/series/pragmatic-nodejs-api/vertical-slices-and-domain-logic",
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
