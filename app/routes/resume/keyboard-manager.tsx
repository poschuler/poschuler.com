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

export function KeyboardManager() {
  let [open, setOpen] = useState(false);
  let {
    basics: { profiles },
  } = useLoaderData<typeof loader>();

  useEffect(() => {
    let down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      profiles.map((item) => {
        if (e.key === item.key && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          window.open(item.url, "_blank", "noopener,noreferrer");
        }
      });
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
                      ⌘{profile.key}
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
