import { Link } from "react-router";
import {
  BookMarked,
  Clock,
  FileCode2,
  Hammer,
  HomeIcon,
  Menu,
  NotebookPen,
  Terminal,
} from "lucide-react";

import { ModeToggle } from "~/components/mode.toggle";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useStrings } from "~/lib/catalog";
import { cn } from "~/lib/utils";

/**
 * One list, rendered twice — the row above `lg`, the panel below it. The icon
 * is read only by the panel; see the note on `Header`. `key` looks up its
 * label in the catalogue rather than carrying one, so the same list drives
 * both Locales.
 */
const NAV_ITEMS = [
  { to: "/", key: "home", Icon: HomeIcon },
  { to: "/projects", key: "projects", Icon: Hammer },
  { to: "/blog", key: "blog", Icon: NotebookPen },
  { to: "/bookmarks", key: "bookmarks", Icon: BookMarked },
  { to: "/timeline", key: "timeline", Icon: Clock },
  { to: "/resume", key: "resume", Icon: FileCode2 },
] as const;

/**
 * The mark, in the header and again at the head of the open panel. Written
 * once because it is one thing: only the element around it differs. In the
 * header it is the link home; in the panel it is not, because `home` is the
 * first item in the list directly under it.
 */
function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 whitespace-nowrap font-semibold text-default text-lg lg:text-base",
        className,
      )}
    >
      <Terminal className="size-6" />
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

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-default border-b bg-subtle px-4 lg:gap-6 lg:px-6">
      <Link to="/" className="mr-auto shrink-0">
        <Wordmark />
      </Link>

      <nav
        aria-label={strings.nav.mainLabel}
        className="hidden items-center gap-6 font-semibold text-low text-sm lg:flex"
      >
        {NAV_ITEMS.map(({ to, key }) => (
          <Link
            key={to}
            to={to}
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

        <SheetContent title={strings.nav.panelTitle} heading={<Wordmark />}>
          {/* Every link is a `SheetClose`: client-side navigation leaves the
            * sheet mounted, so the panel has to dismiss itself on the way out. */}
          <nav aria-label={strings.nav.mainLabel} className="grid gap-1 text-lg">
            {NAV_ITEMS.map(({ to, key, Icon }) => (
              <SheetClose
                key={to}
                render={
                  <Link
                    to={to}
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
        </SheetContent>
      </Sheet>
    </header>
  );
}
