import { Link, useMatches } from "react-router";
import { useLocale } from "~/context";
import { STRINGS } from "~/lib/catalog";
import { switcherDestinationForRoute } from "~/lib/seo/switcher";

/**
 * Shipped hidden for the whole of Phase 3 (`evolution-plan/15-phase-3-spanish.md`
 * Part 9) — the switcher is built, tested and wired into both places
 * `ModeToggle` occupies (`routes/layouts/header.tsx`), but nothing links to it
 * yet: no Spanish document exists to send a reader to, which is what lets
 * this phase be built and deployed without a word of Spanish being written.
 *
 * Exported because `header.tsx` reads it too, to gate the mobile panel's
 * label alongside the control — a label with nothing beside it would be its
 * own visible artifact. Flipping this one line is what a later ticket (#50)
 * does to reveal both.
 */
export const LANGUAGE_SWITCHER_REVEALED = false;

/**
 * A single link to the other Locale — *Español* on an English page, *English*
 * on a Spanish one (Part 9 of `evolution-plan/15-phase-3-spanish.md`).
 *
 * Reads the current page through `useMatches()` rather than a prop: this
 * component lives in the shared layout (`routes/layouts/header.tsx`), above
 * the `Outlet` that decides which page is active, so it has no loader data of
 * its own. `switcherDestinationForRoute` (`app/lib/seo/switcher.ts`) is where
 * a route id becomes a destination, and `switcherDestination`
 * (`app/lib/seo/alternates.ts`) is where a destination is computed — both
 * pure, both unit-tested directly. This component only renders what they
 * return, which is what keeps it thin: this repository has no
 * component-rendering test seam, and this ticket does not add one.
 *
 * The label is looked up by the *destination* Locale, not the page's own —
 * `lang` and `hrefLang` declare the same Locale the label is written in, so a
 * screen reader on an English page does not pronounce *Español* with English
 * phonetics.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const matches = useMatches();
  const locale = useLocale();

  if (!LANGUAGE_SWITCHER_REVEALED) {
    return null;
  }

  const current = matches[matches.length - 1];
  const destination = current
    ? switcherDestinationForRoute(current.id, current.loaderData, locale)
    : null;

  if (!destination) {
    return null;
  }

  const strings = STRINGS[destination.locale];
  const label = destination.section
    ? strings.languageSwitcher.inThisLanguage(strings.languageSwitcher.section[destination.section])
    : strings.languageSwitcher.language;

  return (
    <Link
      to={destination.href}
      lang={destination.locale}
      hrefLang={destination.locale}
      className={className}
    >
      {label}
    </Link>
  );
}
