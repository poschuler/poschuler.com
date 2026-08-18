import { Link, useMatches } from "react-router";
import { button } from "~/components/ui/button";
import { useLocale } from "~/context";
import { STRINGS } from "~/lib/catalog";
import { switcherDestinationForRoute } from "~/lib/seo/switcher";
import { cn } from "~/lib/utils";

/**
 * Whether the switcher renders at all.
 *
 * It shipped `false` for the whole of Phase 3
 * (`evolution-plan/15-phase-3-spanish.md` Part 9): the control was built,
 * tested and wired into both places `ModeToggle` occupies
 * (`routes/layouts/header.tsx`), but nothing linked to it, which is what let
 * the phase be built and deployed without a word of Spanish being written.
 *
 * It is `true` now, and the Spanish branch is still empty. That is a
 * deliberate order, not an oversight: Part 6 gave every index a Locale of its
 * own unconditionally and an empty state to render — *"Todavía no se ha
 * publicado nada aquí"* over a link back to the English one — under
 * `noindex, follow`. A reader who takes the switcher today reaches that
 * answer rather than a 404, and every Spanish document written from here
 * appears behind a control that already exists. What is not yet translated is
 * the home page's own prose, which is content rather than chrome and stays in
 * English by the rule `app/lib/catalog.ts` states.
 *
 * Exported because `header.tsx` reads it too, to gate the mobile panel's
 * label alongside the control — a label with nothing beside it would be its
 * own visible artifact.
 */
export const LANGUAGE_SWITCHER_REVEALED = true;

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
 * The strings are looked up by the *destination* Locale, not the page's own —
 * `lang` and `hrefLang` declare the same Locale they are written in, so a
 * screen reader on an English page does not pronounce *Español* with English
 * phonetics.
 *
 * **What is shown is the subtag; what is announced is the sentence.** The
 * control renders `es` / `en` and carries the words in `aria-label`, which
 * replaces the link's text content for a screen reader rather than adding to
 * it — so nothing hears "es, Español". Two reasons for the split, and neither
 * is width alone:
 *
 *  - Beside six lower-case nav labels, a word reads as a seventh destination.
 *    Two characters read as a control, which is what this is.
 *  - The fallback sentence — *"Blog en español"*, what the switcher says when
 *    this document has no Translation — is a phrase, not a label. In
 *    `aria-label` it still tells a reader the trip is not to this page
 *    translated, without putting a sentence in the header.
 *
 * **A link wearing a button's clothes.** It takes `button({ variant: "ghost",
 * size: "icon" })` — `ModeToggle`'s own pair — so the two preferences sitting
 * side by side read as one pair of controls rather than a word next to a
 * square. It takes the *class*, not the `Button` component: changing Locale is
 * navigation to another address, so the element has to stay an `<a>` that
 * survives middle-click, open-in-new-tab and a crawler, and it is the same
 * pair the document's own `hreflang` declares. Base UI's `useButton` cannot
 * leave that alone — it stamps either `type="button"`, which on an `<a>` names
 * the linked resource's MIME type, or `role="button"`, which costs the link
 * its destination announcement (see `~/components/ui/button`).
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
  const announced = destination.section
    ? strings.languageSwitcher.inThisLanguage(strings.languageSwitcher.section[destination.section])
    : strings.languageSwitcher.language;

  return (
    <Link
      to={destination.href}
      lang={destination.locale}
      hrefLang={destination.locale}
      aria-label={announced}
      title={announced}
      className={cn(button({ variant: "ghost", size: "icon" }), className)}
    >
      {strings.languageSwitcher.code}
    </Link>
  );
}
