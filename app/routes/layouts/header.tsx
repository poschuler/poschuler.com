import { useState } from "react";
import { Link } from "react-router";
import {
  BookMarked,
  Clock,
  FileCode2,
  Hammer,
  Layers,
  Menu,
  NotebookPen,
  Terminal,
} from "lucide-react";

import { LANGUAGE_SWITCHER_REVEALED, LanguageSwitcher } from "~/components/language-switcher";
import { ModeToggle } from "~/components/mode.toggle";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useLocale } from "~/context";
import { useStrings } from "~/lib/catalog";
import { navHref } from "~/lib/hrefs";
import { cn } from "~/lib/utils";

/**
 * One list, rendered twice — the row above `lg`, the panel below it. The icon
 * is read only by the panel; see the note on `Header`. `key` looks up its
 * label in the catalogue rather than carrying one, and `to` is the English
 * path with no prefix, put through `navHref` where it is rendered — so the
 * same list drives both Locales, and a page added here cannot arrive in one
 * of them only.
 *
 * **Home is not in here, in either rendering: the wordmark is the way home.**
 * It used to be the first entry, which put two links to `/` side by side in
 * the row — the mark and the word *home* beside it. The panel dodged that by
 * leaving its own copy of the mark inert, but the fix was asymmetric: the same
 * component meant two different things depending on which breakpoint drew it.
 * The mark is now the link in both, and the list is destinations the mark does
 * not already cover.
 *
 * `/series` is here because it was reachable from exactly one place — the
 * orientation block inside a Part (`routes/series-part/orientation.tsx`) — so
 * the index of the namespace could only be found by someone already inside it.
 * `/tags` is deliberately still not here: a Tag is found from the Post
 * carrying it, and its index is a secondary way in rather than a seventh
 * top-level destination.
 */
const NAV_ITEMS = [
  { to: "/projects", key: "projects", Icon: Hammer },
  { to: "/blog", key: "blog", Icon: NotebookPen },
  { to: "/series", key: "series", Icon: Layers },
  { to: "/bookmarks", key: "bookmarks", Icon: BookMarked },
  { to: "/timeline", key: "timeline", Icon: Clock },
  { to: "/cv", key: "resume", Icon: FileCode2 },
] as const;

/**
 * The mark, in the header and again at the head of the open panel. Written
 * once because it is one thing, and in both places it is wrapped in the link
 * home — the panel's copy closes the panel on the way out, the way every link
 * inside it has to.
 *
 * It carries no `aria-label`. Naming it *home* would replace the visible word
 * with one that isn't on screen, which is what WCAG 2.5.3 (Label in Name) is
 * about: someone driving the page by voice says what they can read. The
 * accessible name is *poschuler*, and a mark pointing at the root is the
 * oldest convention the web has.
 */
function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 whitespace-nowrap font-semibold text-default text-lg lg:text-base",
        className,
      )}
    >
      <Terminal className="size-6" aria-hidden />
      poschuler
    </span>
  );
}

/**
 * One row that reflows, rather than two whole headers hidden past each other.
 *
 * The earlier shape rendered a desktop `<nav>` and a mobile `<nav>`, each with
 * its own copy of the wordmark and the theme toggle, and left the panel trigger
 * outside both — so the only navigation landmark on a phone was one that did
 * not contain the navigation. Everything below is the one row, with the two
 * breakpoint-specific pieces marked as such.
 *
 * The two `<nav>`s that remain — the row and the panel — carry the same label
 * and never coexist: `hidden` takes the row out of the accessibility tree
 * below `lg`, and the trigger that reveals the panel is itself `lg:hidden`.
 *
 * **The row appears at `lg`, not at `md`, and it carries no icons.** Six
 * top-level destinations is a lot for a horizontal nav, and the namespace is
 * closed at eight — this does not get better later. With an icon and a gap
 * against each label the row needed about 1000px, so between `md` and that it
 * overflowed and pushed the theme toggle off the right edge. Either fix alone
 * is marginal; together the row has room to spare at the width it appears.
 *
 * **The switcher (`~/components/language-switcher`) is the eighth control in
 * this row, and its width was checked against that same overflow before it
 * was added — not assumed, because this docblock exists to record a real one
 * (Part 9 of `evolution-plan/15-phase-3-spanish.md`).** The build's own CSS
 * fixes every token the row's width depends on: `--spacing: .25rem` (so
 * `gap-6` is 24px), `--text-sm: .875rem` (14px), the `icon` button at `size-9`
 * above `lg` (36px), and `lg` itself at `64rem` (1024px, `build/client/assets/*.css`
 * after `pnpm build`). Summing those against Inter Semibold's own advance
 * width (about 0.56em per character) puts the row at roughly 670px today —
 * wordmark, six labels and the theme toggle, with their five internal gaps
 * and the header's own three.
 *
 * The switcher costs a second `icon` button inside that cluster: 36px and the
 * cluster's own 4px gap, landing the row at roughly 710px inside the 1024px it
 * has to fit in. That is a fixed cost — it renders a Locale subtag, `en` or
 * `es`, so no string it could be handed makes it wider. It was not always:
 * while it rendered its label as words, the binding case was its fallback
 * sentence *"Proyectos en español"* at roughly 165px, and the row came to
 * roughly 860px. Both fit; only one of them stays true whatever the catalogue
 * says next. There is no headless browser in this environment to render and
 * measure directly; this is the estimate that check leaves behind.
 *
 * Trading *home* for *series* left that estimate standing: the count of
 * labels did not change, and the widest of the two swaps is two characters
 * in English (about 16px) and none in Spanish, where *inicio* and *series*
 * are the same length.
 *
 * The icons stay in the panel, where they earn their place: a vertical list is
 * scanned down a column of glyphs. Six of them strung along one line is
 * texture rather than help, and half of them — blog, timeline, bookmarks — are
 * shapes a reader has to translate back into the word printed beside them.
 *
 * The trigger stays on the right because the panel arrives from the right.
 * Moving one without the other is what makes a slide-over read as arbitrary:
 * the edge it comes from is the thing that says the page is still there,
 * behind it, where you left it.
 */
export function Header() {
  const strings = useStrings();
  const locale = useLocale();
  /**
   * The panel is controlled so its links can be plain links.
   *
   * Every link inside used to be a `SheetClose` wrapping one, which is how
   * Base UI dismisses a dialog — but `Close` is a button, and handing it a
   * `<Link>` through `render` makes it stamp `type="button"` onto an `<a>`,
   * where `type` names the linked resource's MIME type. Told not to
   * (`nativeButton={false}`) it stamps `role="button"` instead, which costs
   * every one of the panel's seven links its destination announcement. The
   * same trap `~/components/ui/button`'s docblock records.
   *
   * Closing is not the dialog's to own here anyway: a client-side navigation
   * leaves the panel mounted over the page it just left, so what has to happen
   * is that following a link closes it. `onClick` says exactly that, and it
   * fires for a link back to the page you are already on — which a
   * location-watching effect would miss, leaving the panel open over an
   * unchanged address.
   */
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-default border-b bg-subtle px-4 lg:gap-6 lg:px-6">
      <Link to={navHref("/", locale)} className="mr-auto shrink-0">
        <Wordmark />
      </Link>

      <nav
        aria-label={strings.nav.mainLabel}
        className="hidden items-center gap-6 font-semibold text-low text-sm lg:flex"
      >
        {NAV_ITEMS.map(({ to, key }) => (
          <Link
            key={to}
            to={navHref(to, locale)}
            className="whitespace-nowrap transition-colors duration-200 hover:text-default"
          >
            {strings.nav[key]}
          </Link>
        ))}
      </nav>

      {/* One cluster, not two more items in the row.
        *
        * Both controls used to sit here as direct children of the header,
        * which means they inherited its `lg:gap-6` — the same 24px that
        * separates `blog` from `series`. Two things spaced like the nav *are*
        * the nav, so the pair read as two stray labels rather than as the
        * preferences they are, and whichever came last looked stranded
        * against the edge. `gap-1` inside, the header's own gap outside: near
        * each other, apart from the row.
        *
        * Language first, theme last. The switcher is a link — it navigates,
        * it changes the address, and it decides *what you read*; it belongs
        * on the side nearer the navigation it behaves like. The theme is a
        * POST that changes one class and nothing you read, so it takes the
        * outer edge. The mobile panel lists them in the same order for the
        * same reason.
        *
        * Above `lg` the pair sits in the row; below it, inside the panel. A
        * preference does not belong shoulder to shoulder with the one control
        * that opens the navigation — on a phone that is two adjacent targets
        * where only one of them matters. Gated as a pair, so the switcher
        * being hidden (`~/components/language-switcher`) leaves the theme
        * toggle exactly where it was. */}
      <div className="hidden shrink-0 items-center gap-1 lg:flex">
        <LanguageSwitcher />
        <ModeToggle />
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 lg:hidden"
            />
          }
        >
          <Menu className="size-5" />
          <span className="sr-only">{strings.nav.openMenu}</span>
        </SheetTrigger>

        {/* The panel's mark is the same link the row's is. `-m-2 p-2` grows
          * the target to something a thumb can hit without moving the mark
          * off the baseline the close button sits on. */}
        <SheetContent
          title={strings.nav.panelTitle}
          heading={
            <Link to={navHref("/", locale)} onClick={closeNav} className="-m-2 rounded-md p-2">
              <Wordmark />
            </Link>
          }
        >
          {/* Every link closes the panel on the way out — see `navOpen` above
            * for why that is an `onClick` and not a `SheetClose`. */}
          <nav aria-label={strings.nav.mainLabel} className="grid gap-1 text-lg">
            {NAV_ITEMS.map(({ to, key, Icon }) => (
              <Link
                key={to}
                to={navHref(to, locale)}
                onClick={closeNav}
                className="flex items-center gap-3 rounded-md px-2 py-3 text-low transition-colors hover:bg-hover hover:text-default"
              >
                <Icon className="size-5" />
                {strings.nav[key]}
              </Link>
            ))}
          </nav>

          {/* The preferences, in the row's own order: language, then theme.
            *
            * Bled back out to the panel's edge, so this divider lines up with
            * the one under the panel's own header rather than floating inset
            * from it. The border and the `mt-auto` that pins the block to the
            * bottom live on the wrapper rather than on whichever row happens
            * to come first, so hiding the switcher
            * (`~/components/language-switcher`) leaves the panel's shape
            * untouched.
            *
            * A row each, not one shared row. Both controls are the same
            * square now and neither says what it is: `es` and `☾` each need
            * the word beside them, and one row cannot carry two words. */}
          <div className="-mx-4 mt-auto space-y-4 border-default border-t px-4 pt-4">
            {LANGUAGE_SWITCHER_REVEALED && (
              <div className="flex items-center justify-between">
                <span className="text-low text-sm">{strings.nav.languageRowLabel}</span>
                <LanguageSwitcher onClick={closeNav} />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-low text-sm">{strings.nav.themeRowLabel}</span>
              <ModeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
