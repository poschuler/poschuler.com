import { Link } from "react-router";
import { BookMarked, FileCode2, GitMerge, HomeIcon, Menu, NotebookPen, Terminal } from "lucide-react";
import { ModeToggle } from "~/components/mode.toggle";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";

export function Header() {
  return (
    <header className="sticky top-0 flex h-16 items-center gap-4 bg-subtle border-default border-b bg-background px-4 md:px-6 justify-end md:justify-normal z-10">
      <nav className="hidden flex-col gap-6 text-de text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 flex-grow">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
          reloadDocument={true}
        >
          <Terminal className="h-6 w-6" />
          <span>poschuler</span>
        </Link>
        <div className="flex flex-grow justify-end items-center gap-6 text-low text-lg font-semibold md:text-base">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-default"
          >
            <HomeIcon className="h-4 w-4" />
            <span>home</span>
          </Link>
          <Link
            to="/blog"
            className="flex items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-default"
          >
            <NotebookPen className="h-4 w-4" />
            <span>blog</span>
          </Link>
          <Link
            to="/bookmarks"
            className="flex items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-default"
          >
            <BookMarked className="h-4 w-4" />
            <span>bookmarks</span>
          </Link>
          <Link
            to="/cv"
            className="flex items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-default"
          >
            <FileCode2 className="h-4 w-4" />
            cv
          </Link>
          <ModeToggle />
        </div>
      </nav>

      <nav className="flex md:hidden gap-6 text-lg font-medium flex-grow">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
          reloadDocument={true}
        >
          <Terminal className="h-6 w-6" />
          <span>poschuler</span>
        </Link>
        <div className="flex flex-grow justify-end items-center gap-6 text-lg font-semibold md:text-base">
          <ModeToggle />
        </div>
      </nav>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              to="/"
              className="flex items-center gap-2 text-lg text-default font-semibold"
              reloadDocument={true}
            >
              <Terminal className="h-6 w-6" />
              <span>poschuler</span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 text-low transition-colors duration-200 hover:text-default"
              reloadDocument={true}
            >
              <HomeIcon className="h-4 w-4" />
              home
            </Link>

            <Link
              to="/blog"
              className="flex items-center gap-2 text-low transition-colors duration-200 hover:text-default"
              reloadDocument={true}
            >
              <NotebookPen className="h-4 w-4" />
              blog
            </Link>


            <Link
              to="/bookmarks"
              className="flex items-center gap-2 text-low transition-colors duration-200 hover:text-default"
              reloadDocument={true}
            >
              <BookMarked className="h-4 w-4" />
              bookmarks
            </Link>

            <Link
              to="/cv"
              className="flex items-center gap-2 text-low transition-colors duration-200 hover:text-default"
              reloadDocument={true}
            >
              <FileCode2 className="h-4 w-4" />
              cv
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
