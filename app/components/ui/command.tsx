import * as React from "react";
import {
  Autocomplete,
  type AutocompleteEmptyProps,
  type AutocompleteGroupProps,
  type AutocompleteInputProps,
  type AutocompleteItemProps,
  type AutocompleteListProps,
} from "@base-ui/react/autocomplete";
import { Search } from "lucide-react";

import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

type StyledProps<Props> = Omit<Props, "className"> & { className?: string };

/**
 * The palette renders its list inside a dialog rather than in a popup of its
 * own, so `Command` must always be given `inline` and an unconditional `open`:
 * `<Command inline open items={…}>`.
 */
const Command = Autocomplete.Root;

/** Renders one child per item left after filtering. */
const CommandCollection = Autocomplete.Collection;

type CommandDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Announced to screen readers; the palette shows no visible heading. */
  title?: string;
  children?: React.ReactNode;
};

function CommandDialog({
  open,
  onOpenChange,
  title = "Command palette",
  children,
}: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: StyledProps<AutocompleteInputProps>) {
  return (
    <div className="flex items-center border-b px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <Autocomplete.Input
        className={cn(
          "flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-low disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: StyledProps<AutocompleteListProps>) {
  return (
    <Autocomplete.List
      className={cn(
        "max-h-[300px] overflow-y-auto overflow-x-hidden p-1",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: StyledProps<AutocompleteEmptyProps>) {
  return (
    <Autocomplete.Empty
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  );
}

type CommandGroupProps = StyledProps<AutocompleteGroupProps> & {
  heading?: React.ReactNode;
};

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: CommandGroupProps) {
  return (
    <Autocomplete.Group
      className={cn("overflow-hidden px-2 text-default", className)}
      {...props}
    >
      {heading ? (
        <Autocomplete.GroupLabel className="px-2 py-1.5 text-xs font-medium text-low">
          {heading}
        </Autocomplete.GroupLabel>
      ) : null}
      {children}
    </Autocomplete.Group>
  );
}

function CommandItem({ className, ...props }: StyledProps<AutocompleteItemProps>) {
  return (
    <Autocomplete.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-hover data-[highlighted]:text-default data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: StyledProps<React.ComponentProps<typeof Autocomplete.Separator>>) {
  return (
    <Autocomplete.Separator
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-low",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandCollection,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
