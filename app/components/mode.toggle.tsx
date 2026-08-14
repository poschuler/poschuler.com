import { Monitor, Moon, Sun } from "lucide-react";
import { Form, useRouteLoaderData } from "react-router";
import { IconButton } from "~/components/ui/icon-button";
import type { ColorScheme } from "~/color-scheme-cookie";

type RootData = { colorScheme?: ColorScheme };

// The `value` doubles as the visible word: `light`, `dark` and `system` are
// what the button says and what the form posts, so there is no second name to
// keep in step with the first.
const LIGHT = { value: "light", Icon: Sun } as const;
const DARK = { value: "dark", Icon: Moon } as const;
const SYSTEM = { value: "system", Icon: Monitor } as const;

const BY_VALUE = { light: LIGHT, dark: DARK, system: SYSTEM };
/** Cycle order — light → dark → system → light. */
const NEXT = { light: DARK, dark: SYSTEM, system: LIGHT };

/**
 * One button that advances the theme, rather than three that sit there.
 *
 * The whole mechanism is a plain POST to `/set-theme`: the server owns the
 * choice, so there is no client JS, no provider and no flash of the wrong
 * theme to prevent — the class is already on `<html>` in the first byte.
 */
export function ModeToggle() {
  const root = useRouteLoaderData("root") as RootData | undefined;
  const active = root?.colorScheme ?? "system";
  const current = BY_VALUE[active] ?? SYSTEM;
  const next = NEXT[current.value];
  const { Icon } = current;

  return (
    <Form navigate={false} method="POST" action="/set-theme" className="shrink-0">
      <IconButton
        type="submit"
        variant="outline"
        name="color-scheme"
        value={next.value}
        title={`Theme: ${current.value} — switch to ${next.value}`}
      >
        <Icon className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">
          Theme: {current.value}. Switch to {next.value}
        </span>
      </IconButton>
    </Form>
  );
}
