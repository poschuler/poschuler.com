import {
  GitHubLogoIcon,
  LinkedInLogoIcon,
  TwitterLogoIcon,
} from "@radix-ui/react-icons";
import { useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "~/components/ui/command";
import type { loader } from "./_cv";

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
      {/* <div className="fixed right-4 bottom-4">
        <p className="text-sm text-muted-foreground"></p>
      </div> */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Links" className="font-mono">
            {profiles.map((item) => (
              <a
                key={item.row}
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                <CommandItem className="cursor-pointer">
                  {item.network === "GitHub" && (
                    <GitHubLogoIcon className="mr-2 size-4 text-muted-foreground" />
                  )}

                  {item.network === "LinkedIn" && (
                    <LinkedInLogoIcon className="mr-2 size-4 text-muted-foreground" />
                  )}

                  {item.network === "X" && (
                    <TwitterLogoIcon className="mr-2 size-4 text-muted-foreground" />
                  )}

                  <span className="font-mono">{item.network}</span>

                  {item.network === "GitHub" && (
                    <CommandShortcut className="uppercase">
                      ⌘{item.key}
                    </CommandShortcut>
                  )}

                  {item.network === "LinkedIn" && (
                    <CommandShortcut className="uppercase">
                      ⌘{item.key}
                    </CommandShortcut>
                  )}

                  {item.network === "X" && (
                    <CommandShortcut className="uppercase">
                      ⌘{item.key}
                    </CommandShortcut>
                  )}
                </CommandItem>
              </a>
            ))}
          </CommandGroup>
          {/* <CommandSeparator />
          <CommandGroup heading="Action">
            <CommandItem>
              <Printer className="mr-2 size-4" />
              <span>Print</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
          </CommandGroup> */}
        </CommandList>
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
