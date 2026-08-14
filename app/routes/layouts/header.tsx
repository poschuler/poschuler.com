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

/** One list, rendered twice — the row above `md`, the panel below it. */
const NAV_ITEMS = [
  { to: "/", label: "home", Icon: HomeIcon },
  { to: "/projects", label: "projects", Icon: Hammer },
  { to: "/blog", label: "blog", Icon: NotebookPen },
  { to: "/bookmarks", label: "bookmarks", Icon: BookMarked },
  { to: "/timeline", label: "timeline", Icon: Clock },
  { to: "/resume", label: "resume", Icon: FileCode2 },
] as const;

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
 * below `md`, and the trigger that reveals the panel is itself `md:hidden`.
 *
 * The trigger stays on the right because the panel arrives from the right.
 * Moving one without the other is what makes a slide-over read as arbitrary:
 * the edge it comes from is the thing that says the page is still there,
 * behind it, where you left it.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-default border-b bg-subtle px-4 md:gap-6 md:px-6">
      <Link
        to="/"
        className="mr-auto flex items-center gap-2 font-semibold text-default text-lg md:text-base"
      >
        <Terminal className="size-6" />
        <span>poschuler</span>
      </Link>

      <nav
        aria-label="Main"
        className="hidden items-center gap-6 font-semibold text-low text-sm md:flex"
      >
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2 transition-colors duration-200 hover:text-default"
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Above `md` the toggle sits in the row; below it, inside the panel.
        * It is a preference, and a preference does not belong shoulder to
        * shoulder with the one control that opens the navigation — on a phone
        * that is two adjacent targets where only one of them matters. */}
      <ModeToggle className="hidden md:block" />

      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            />
          }
        >
          <Menu className="size-5" />
          <span className="sr-only">Open navigation</span>
        </SheetTrigger>

        <SheetContent title="Navigation">
          {/* Every link is a `SheetClose`: client-side navigation leaves the
            * sheet mounted, so the panel has to dismiss itself on the way out. */}
          <nav aria-label="Main" className="grid gap-1 text-lg">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
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
                {label}
              </SheetClose>
            ))}
          </nav>

          {/* Bled back out to the panel's edge, so this divider lines up with
            * the one under the panel's own header rather than floating inset
            * from it. */}
          <div className="-mx-4 mt-auto flex items-center justify-between border-default border-t px-4 pt-4">
            <span className="text-low text-sm">Theme</span>
            <ModeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
