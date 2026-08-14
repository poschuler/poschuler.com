import * as React from "react";
import {
  Dialog as BaseDialog,
  type DialogBackdropProps,
  type DialogDescriptionProps,
  type DialogPopupProps,
  type DialogTitleProps,
} from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "~/lib/utils";

const Sheet = BaseDialog.Root;
const SheetTrigger = BaseDialog.Trigger;
const SheetClose = BaseDialog.Close;
const SheetPortal = BaseDialog.Portal;

/** Base UI drives transitions off `data-open` / `data-closed`, not `data-state`. */
type StyledProps<Props> = Omit<Props, "className"> & { className?: string };

function SheetOverlay({
  className,
  ...props
}: StyledProps<DialogBackdropProps>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/80 data-[open]:animate-sheet-backdrop-in data-[closed]:animate-sheet-backdrop-out",
        className,
      )}
      {...props}
    />
  );
}

/* One side, because one side is what the site opens: the mobile navigation.
 * The other three cost four keyframe pairs each to animate and are three
 * layouts nothing has asked for. */
const SHEET_PANEL =
  "fixed inset-y-0 right-0 z-50 h-full w-3/4 gap-4 bg-subtle p-6 shadow-lg data-[open]:animate-sheet-in data-[closed]:animate-sheet-out sm:max-w-sm";

function SheetContent({
  className,
  children,
  ...props
}: StyledProps<DialogPopupProps>) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <BaseDialog.Popup className={cn(SHEET_PANEL, className)} {...props}>
        {children}
        <BaseDialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-default disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </SheetPortal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: StyledProps<DialogTitleProps>) {
  return (
    <BaseDialog.Title
      className={cn("text-lg font-semibold text-default", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: StyledProps<DialogDescriptionProps>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-low", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
