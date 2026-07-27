import { Moon, Sun, SunMoon } from "lucide-react";
import { Theme, useTheme } from "remix-themes";
import { ClientOnly } from "remix-utils/client-only";
import { IconButton } from "~/components/ui/icon-button";

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
          <span className="sr-only">Toggle theme</span>
        </IconButton>
      )}
    </ClientOnly>
  );
}

function StaticModeToggle() {
  return (
    <IconButton variant="outline">
      <SunMoon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <span className="sr-only">Toggle theme</span>
    </IconButton>
  );
}
