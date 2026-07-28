import * as React from "react";
import {
  Dialog as BaseDialog,
  type DialogBackdropProps,
  type DialogDescriptionProps,
  type DialogPopupProps,
  type DialogTitleProps,
} from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
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
        // The backdrop has to run on the panel's clock: left on the 150ms
        // default it finished fading half a close early and — with the default
        // `animation-fill-mode: none` — snapped back to full black until the
        // panel's own animation ended and Base UI unmounted the pair.
        "fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:duration-500 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:duration-300 data-[closed]:fill-mode-forwards",
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  // `fill-mode-forwards` holds the off-screen end state: Base UI unmounts a
  // frame or two after the animation finishes, and without it the panel snaps
  // back into view for that gap.
  "fixed z-50 gap-4 bg-subtle p-6 shadow-lg transition ease-in-out data-[open]:animate-in data-[closed]:animate-out data-[closed]:duration-300 data-[open]:duration-500 data-[closed]:fill-mode-forwards",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[closed]:slide-out-to-top data-[open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[closed]:slide-out-to-left data-[open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 data-[closed]:slide-out-to-right data-[open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

type SheetContentProps = StyledProps<DialogPopupProps> &
  VariantProps<typeof sheetVariants>;

function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <BaseDialog.Popup
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <BaseDialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
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
      className={cn("text-lg font-semibold text-foreground", className)}
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
      className={cn("text-sm text-muted-foreground", className)}
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
