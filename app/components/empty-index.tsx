import { Link } from "react-router";
import { useLocale } from "~/context";
import { useStrings } from "~/lib/catalog";

/**
 * What an index renders when its list is empty, rather than the list itself
 * (Part 6 of `evolution-plan/15-phase-3-spanish.md`).
 *
 * An index is skeleton, not leaf: it is in the navigation, and a navigation of
 * dead links is worse than an empty page. So it stays at its address and
 * answers 200 — the route's own `meta` is what adds `noindex, follow` for as
 * long as this renders — and says what is happening rather than showing
 * nothing at all.
 *
 * `englishHref` is the literal English address, not derived through
 * `withLocale`: the one Locale this can point at is fixed by Part 6 itself —
 * "links to the English version" — so there is no Locale to pass in.
 *
 * **The link is Spanish-only.** Every route that renders this today can only
 * be empty in Spanish — there is no `.en.md` yet, and English never runs out.
 * If the English list itself were ever empty (an empty database, every
 * Project archived), offering "Read it in English" while already on the
 * English page would be a link to the address the reader is already on; the
 * guard is what a caller's own Locale check would otherwise have to repeat at
 * every one of the four call sites.
 */
export function EmptyIndex({ englishHref }: { englishHref: string }) {
  const strings = useStrings();
  const locale = useLocale();

  return (
    <section className="mx-auto w-full max-w-measure py-8 text-center">
      <p className="text-low">{strings.emptyIndex.message}</p>

      {locale !== "en" && (
        <Link
          to={englishHref}
          lang="en"
          hrefLang="en"
          className="mt-2 inline-block text-low underline underline-offset-4 transition-colors duration-200 hover:text-default"
        >
          {strings.emptyIndex.readInEnglish}
        </Link>
      )}
    </section>
  );
}
