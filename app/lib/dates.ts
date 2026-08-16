import type { Locale } from "~/context";

/**
 * A Post's publication date, formatted for the reader who will see it (Part 10
 * of `evolution-plan/15-phase-3-spanish.md`).
 *
 * Called from a loader, and only from a loader. `Date.prototype.toLocaleDateString`
 * reads whichever locale it is given — pass none and it reads the runtime's
 * own, which is not the reader's. Calling it from a component instead of here
 * would also reopen the hydration warning `RevisionLine`'s docblock records:
 * the server and the browser do not agree on a default locale. This function
 * runs once, in the loader, and its result travels to the browser already
 * serialised — there is no second call on the client to disagree with the
 * first, so that warning does not apply to this call site. Keep the call here.
 */
export function formatPostDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale);
}
