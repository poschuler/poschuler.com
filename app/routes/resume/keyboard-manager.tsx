import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { CommandPalette } from "./command-palette";
import { basics } from "./resume.json";

/** True for anything a keystroke could legitimately be meant for. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * The Resume's keyboard surface: ⌘J opens the palette, ⌘⇧<key> jumps straight
 * to a profile. The palette itself is `command-palette.tsx`; this component
 * owns only the bindings and the button that opens it without one.
 */
export function KeyboardManager() {
  let [open, setOpen] = useState(false);
  let { profiles } = basics;

  useEffect(() => {
    let down = (event: KeyboardEvent) => {
      // Never steal a keystroke aimed at a text field — including the palette's
      // own search input.
      if (isTypingTarget(event.target)) {
        return;
      }

      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      if (event.key.toLowerCase() === "j" && !event.shiftKey) {
        event.preventDefault();
        setOpen((open) => !open);
        return;
      }

      // The profile shortcuts additionally require Shift. Without it they sat
      // on ⌘X (cut), ⌘L (address bar) and ⌘G (find next) — bindings the browser
      // owns and a reader expects to work.
      if (!event.shiftKey) {
        return;
      }

      for (const profile of profiles) {
        if (event.key.toLowerCase() === profile.key) {
          event.preventDefault();
          window.open(profile.url, "_blank", "noopener,noreferrer");
          return;
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [profiles]);

  return (
    <>
      <CommandPalette open={open} onOpenChange={setOpen} profiles={profiles} />
      <Button
        variant="soft"
        onClick={() => setOpen(!open)}
        className="fixed right-4 bottom-4 print:hidden"
      >
        Press{" "}
        <kbd className="ml-2">
          <span className="text-xs">⌘</span> J
        </kbd>
      </Button>
    </>
  );
}
