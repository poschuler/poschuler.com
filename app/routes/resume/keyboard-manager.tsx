import { useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { BrandNetworkIcon } from "~/components/ui/brand-icons";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "~/components/ui/command";
import type { loader } from "./_resume";

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

export function KeyboardManager() {
  let [open, setOpen] = useState(false);
  let {
    basics: { profiles },
  } = useLoaderData<typeof loader>();

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

  let handleClick = () => {
    setOpen(!open);
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command
          inline
          open
          items={profiles}
          itemToStringValue={(profile) => profile.network}
        >
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Links" className="font-mono">
              <CommandCollection>
                {(profile) => (
                  <CommandItem
                    key={profile.row}
                    value={profile}
                    render={
                      <a
                        href={profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <BrandNetworkIcon
                      network={profile.network}
                      className="mr-2 size-4 text-muted-foreground"
                    />
                    <span className="font-mono">{profile.network}</span>
                    <CommandShortcut className="uppercase">
                      ⌘⇧{profile.key}
                    </CommandShortcut>
                  </CommandItem>
                )}
              </CommandCollection>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
      <Button
        onClick={handleClick}
        className="fixed bottom-4 right-4 flex print:hidden px-3 h-8"
        variant={"secondary"}
      >
        Press{" "}
        <kbd className="ml-2">
          <span className="text-xs">⌘</span> J
        </kbd>
      </Button>
    </>
  );
}
