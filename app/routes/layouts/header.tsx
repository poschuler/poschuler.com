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
  SheetClose,
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
 * and the header's own three. The switcher's longest realistic label is not
 * *Español* but its own fallback sentence, *"Proyectos en español"* (Part 9),
 * at roughly 165px including its gap — landing the row at roughly 860px,
 * still over 160px inside the 1024px it has to fit in. There is no headless
 * browser in this environment to render and measure directly; this is the
 * estimate that check leaves behind.
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

      {/* Above `lg` the toggle sits in the row; below it, inside the panel.
        * It is a preference, and a preference does not belong shoulder to
        * shoulder with the one control that opens the navigation — on a phone
        * that is two adjacent targets where only one of them matters. */}
      <ModeToggle className="hidden shrink-0 lg:block" />

      {/* Shipped hidden (`~/components/language-switcher`'s own docblock) —
        * `LANGUAGE_SWITCHER_REVEALED` is `false` for the whole of Phase 3, so
        * this renders nothing today. The classes are the ones it takes the
        * day that flips: `ModeToggle`'s own pattern, one control to its
        * right. */}
      <LanguageSwitcher className="hidden shrink-0 lg:block" />

      <Sheet>
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
            <SheetClose
              render={<Link to={navHref("/", locale)} className="-m-2 rounded-md p-2" />}
            >
              <Wordmark />
            </SheetClose>
          }
        >
          {/* Every link is a `SheetClose`: client-side navigation leaves the
            * sheet mounted, so the panel has to dismiss itself on the way out. */}
          <nav aria-label={strings.nav.mainLabel} className="grid gap-1 text-lg">
            {NAV_ITEMS.map(({ to, key, Icon }) => (
              <SheetClose
                key={to}
                render={
                  <Link
                    to={navHref(to, locale)}
                    className="flex items-center gap-3 rounded-md px-2 py-3 text-low transition-colors hover:bg-hover hover:text-default"
                  />
                }
              >
                <Icon className="size-5" />
                {strings.nav[key]}
              </SheetClose>
            ))}
          </nav>

          {/* Bled back out to the panel's edge, so this divider lines up with
            * the one under the panel's own header rather than floating inset
            * from it. */}
          <div className="-mx-4 mt-auto flex items-center justify-between border-default border-t px-4 pt-4">
            <span className="text-low text-sm">{strings.nav.themeRowLabel}</span>
            <ModeToggle />
          </div>

          {/* Its own row rather than folded into the one above: `ModeToggle`
            * carries a label but `LanguageSwitcher` reads as its own label —
            * "Español" — so pairing them under one word would leave one
            * control unlabelled. Gated on the same flag the row above reads
            * from `~/components/language-switcher`: a bare label with no
            * control beside it, were this rendered while the switcher itself
            * returns nothing, would be its own visible artifact. */}
          {LANGUAGE_SWITCHER_REVEALED && (
            <div className="-mx-4 flex items-center justify-between px-4 pt-4">
              <span className="text-low text-sm">{strings.nav.languageRowLabel}</span>
              <LanguageSwitcher />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}
