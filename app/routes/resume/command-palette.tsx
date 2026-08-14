import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { Search } from "lucide-react";

import { BrandNetworkIcon } from "~/components/ui/brand-icons";
import type { BrandNetwork } from "~/components/ui/brand-icons";

type Profile = {
  row: number;
  network: string;
  url: string;
  key: string;
};

/**
 * The Resume's ⌘J palette: a filterable list of the profiles in `resume.json`.
 *
 * Written out here rather than assembled from a `ui/command` and a `ui/dialog`
 * of thin wrappers. That arrangement was eight exported components and a
 * re-exported dialog, every one of them a single `className` around a Base UI
 * part, and every one with exactly one caller — this file. The wrappers named
 * nothing the part did not already name, and the indirection cost more than it
 * saved. `ui/` earns a component when a second surface asks for it.
 *
 * Two Base UI details are load-bearing. The list renders **inside** the dialog
 * rather than in a popup of its own, which is why `Autocomplete.Root` is given
 * `inline` and an unconditional `open`. And the popup carries no entrance: see
 * the motion section of `docs/design.md` — it arrives from no edge and it
 * autofocuses the input.
 */
export function CommandPalette({
  open,
  onOpenChange,
  profiles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={[
            "fixed inset-0 z-50 bg-overlay",
            "transition-opacity duration-panel ease-panel",
            "data-ending-style:duration-panel-out data-ending-style:ease-in",
            "data-starting-style:opacity-0 data-ending-style:opacity-0",
            "motion-reduce:transition-none",
          ].join(" ")}
        />
        <Dialog.Popup className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-full max-w-lg overflow-hidden border border-default bg-app shadow-lg focus:outline-none sm:rounded-lg">
          {/* The palette shows no visible heading, but a dialog without an
            * accessible name is announced as nothing. */}
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>

          <Autocomplete.Root
            inline
            open
            items={profiles}
            itemToStringValue={(profile: Profile) => profile.network}
          >
            <div className="flex items-center border-default border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Autocomplete.Input
                placeholder="Type a command or search..."
                className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-low"
              />
            </div>

            <Autocomplete.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
              <Autocomplete.Empty className="py-6 text-center text-sm">
                No results found.
              </Autocomplete.Empty>

              <Autocomplete.Group className="overflow-hidden px-2 font-mono text-default">
                <Autocomplete.GroupLabel className="px-2 py-1.5 font-medium text-low text-xs">
                  Links
                </Autocomplete.GroupLabel>

                <Autocomplete.Collection>
                  {(profile: Profile) => (
                    <Autocomplete.Item
                      key={profile.row}
                      value={profile}
                      className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-hover data-[highlighted]:text-default"
                      render={
                        <a
                          href={profile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <BrandNetworkIcon
                        network={profile.network as BrandNetwork}
                        className="mr-2 size-4 text-low"
                      />
                      <span>{profile.network}</span>
                      <span className="ml-auto text-low text-xs uppercase tracking-widest">
                        ⌘⇧{profile.key}
                      </span>
                    </Autocomplete.Item>
                  )}
                </Autocomplete.Collection>
              </Autocomplete.Group>
            </Autocomplete.List>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
