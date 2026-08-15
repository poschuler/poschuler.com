/**
 * The ways to reach him, and where he is. One list, because three surfaces
 * render it — the home page's hero, the footer on every page, and the home
 * page's `Person` structured data, whose `sameAs` is derived from this rather
 * than restated so a crawler and a reader cannot be told different things.
 *
 * X is deliberately absent. It is in `resume.json` because the Resume's
 * command palette offers it, and it is not here because it is not one of the
 * three links this site leads with.
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
