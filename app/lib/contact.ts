/**
 * The ways to reach him, and where he is. One list, because three surfaces
 * render it — the home page's hero, the footer on every page, and the home
 * page's `Person` structured data, whose `sameAs` is derived from this rather
 * than restated so a crawler and a reader cannot be told different things.
 *
 * Two profiles and an address, and the same two the Resume links to. X used to
 * be on the Resume alone — its icon row, its command palette, its `sameAs` —
 * and is now nowhere, so there is one answer to "where does this person
 * publish" rather than one per page.
 */
export const CONTACT_LINKS = [
  { label: "poschuler@gmail.com", href: "mailto:poschuler@gmail.com" },
  { label: "GitHub", href: "https://github.com/poschuler" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/poschuler/" },
] as const;

/**
 * A fact about where the work happens, not a signal that he is looking. The
 * timezone is the part a distributed team screens on.
 */
export const LOCATION = "Lima, Peru · UTC-5";
