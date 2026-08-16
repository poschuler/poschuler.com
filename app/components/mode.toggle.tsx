import { Monitor, Moon, Sun } from "lucide-react";
import { Form, useRouteLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { useStrings } from "~/lib/catalog";
import { cn } from "~/lib/utils";
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
export function ModeToggle({ className }: { className?: string }) {
  const root = useRouteLoaderData("root") as RootData | undefined;
  const active = root?.colorScheme ?? "system";
  const current = BY_VALUE[active] ?? SYSTEM;
  const next = NEXT[current.value];
  const { Icon } = current;
  const strings = useStrings();
  // `current.value`/`next.value` stay `light`/`dark`/`system` — the cookie's
  // own vocabulary, posted verbatim by the form below. What is translated is
  // only the word shown for each, looked up beside the sentence that uses it.
  const currentLabel = strings.theme.mode[current.value];
  const nextLabel = strings.theme.mode[next.value];

  return (
    <Form
      navigate={false}
      method="POST"
      action="/set-theme"
      className={cn("shrink-0", className)}
    >
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        name="color-scheme"
        value={next.value}
        title={strings.theme.tooltip(currentLabel, nextLabel)}
      >
        <Icon className="size-5" />
        <span className="sr-only">{strings.theme.srAnnouncement(currentLabel, nextLabel)}</span>
      </Button>
    </Form>
  );
}
