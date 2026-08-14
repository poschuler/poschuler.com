import { Link } from "react-router";
import { BookMarked, Clock, FileCode2, Hammer, HomeIcon, Menu, NotebookPen, Terminal } from "lucide-react";
import { ModeToggle } from "~/components/mode.toggle";
import { Button } from "~/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "~/components/ui/sheet";

/** One list, rendered twice — desktop nav and mobile sheet. */
const NAV_ITEMS = [
  { to: "/", label: "home", Icon: HomeIcon },
  { to: "/projects", label: "projects", Icon: Hammer },
  { to: "/blog", label: "blog", Icon: NotebookPen },
  { to: "/bookmarks", label: "bookmarks", Icon: BookMarked },
  { to: "/timeline", label: "timeline", Icon: Clock },
  { to: "/resume", label: "resume", Icon: FileCode2 },
] as const;

function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={className}>
      <Terminal className="h-6 w-6" />
      <span>poschuler</span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 flex h-16 items-center gap-4 bg-subtle border-default border-b px-4 md:px-6 justify-end md:justify-normal z-10">
      <nav className="hidden flex-col gap-6 text-default text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 flex-grow">
        <Wordmark className="flex items-center gap-2 text-lg font-semibold md:text-base" />
        <div className="flex flex-grow justify-end items-center gap-6 text-low text-lg font-semibold md:text-base">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 text-low transition-colors duration-200 hover:text-default"
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          ))}
          <ModeToggle />
        </div>
      </nav>

      <nav className="flex md:hidden gap-6 text-lg font-medium flex-grow">
        <Wordmark className="flex items-center gap-2 text-lg font-semibold md:text-base" />
        <div className="flex flex-grow justify-end items-center gap-6 text-lg font-semibold md:text-base">
          <ModeToggle />
        </div>
      </nav>

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
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </SheetTrigger>
        <SheetContent side="right">
          {/* Every link is a `SheetClose`: client-side navigation leaves the
            * sheet mounted, so the panel has to dismiss itself on the way out. */}
          <nav className="grid gap-6 text-lg font-medium">
            <SheetClose
              render={
                <Link
                  to="/"
                  className="flex items-center gap-2 text-lg text-default font-semibold"
                />
              }
            >
              <Terminal className="h-6 w-6" />
              <span>poschuler</span>
            </SheetClose>

            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <SheetClose
                key={to}
                render={
                  <Link
                    to={to}
                    className="flex items-center gap-2 text-low transition-colors duration-200 hover:text-default"
                  />
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </SheetClose>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
