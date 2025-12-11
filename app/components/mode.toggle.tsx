import { Moon, Sun, SunMoon } from "lucide-react";
import { Theme, useTheme } from "remix-themes";
import { ClientOnly } from "remix-utils/client-only";
// import { Button } from "./ui/button";
import { IconButton } from "~/components/chekalo/IconButton";

export function ModeToggle() {
  const [theme, setTheme] = useTheme();

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
    );
  };

  return (
    <ClientOnly fallback={<StaticModeToggle />}>
      {() => (
        <IconButton
          variant="outline"
          onPress={toggleTheme}
        >
          {theme === Theme.LIGHT && (
            <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          )}

          {theme === Theme.DARK && (
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          )}
          <span className="sr-only">Cambiar tema</span>
        </IconButton>
        // <Button
        //   variant="ghost"
        //   size="icon"
        //   className="h-8 w-8"
        //   onClick={toggleTheme}
        // >

        //   <span className="sr-only">Cambiar tema</span>
        // </Button>
      )}
    </ClientOnly>
  );
}

function StaticModeToggle() {
  return (
    <IconButton variant="outline">
      <SunMoon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <span className="sr-only">Cambiar tema</span>
    </IconButton>
  );
}

export function FloatModeToggle() {
  const [theme, setTheme] = useTheme();

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
    );
  };

  return (
    <ClientOnly fallback={<StaticFloatModeToggle />}>
      {() => (
        <IconButton
          variant="outline"
          className="fixed left-4 top-4 flex h-12 w-12 items-center justify-center whitespace-nowrap rounded-full border border-input bg-background text-sm font-medium shadow-2xl ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onPress={toggleTheme}
        >
          {theme === Theme.LIGHT && (
            <Moon className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          )}

          {theme === Theme.DARK && (
            <Sun className="size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          )}
          <span className="sr-only">Cambiar tema</span>
        </IconButton>
      )}
    </ClientOnly>
  );
}

function StaticFloatModeToggle() {
  return (
    <IconButton
      variant="outline"
      className="fixed left-4 top-4 flex h-12 w-12 items-center justify-center whitespace-nowrap rounded-full border border-input bg-background text-sm font-medium shadow-2xl ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    >
      <SunMoon className="size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambiar tema</span>
    </IconButton>
  );
}
