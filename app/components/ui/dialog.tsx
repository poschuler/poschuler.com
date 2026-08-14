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

const Dialog = BaseDialog.Root;
const DialogTrigger = BaseDialog.Trigger;
const DialogPortal = BaseDialog.Portal;
const DialogClose = BaseDialog.Close;

/** Base UI drives transitions off `data-open` / `data-closed`, not `data-state`. */
type StyledProps<Props> = Omit<Props, "className"> & { className?: string };

function DialogOverlay({
  className,
  ...props
}: StyledProps<DialogBackdropProps>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        // Same clock as the popup, and `fill-mode-forwards` so the faded-out
        // end state holds: on the default `animation-fill-mode: none` the
        // backdrop snapped back to full black until Base UI unmounted it.
        "fixed inset-0 z-50 bg-black/80 duration-200 data-[open]:animate-in data-[open]:fade-in-0 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:fill-mode-forwards",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: StyledProps<DialogPopupProps>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <BaseDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-app p-6 shadow-lg duration-200 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[open]:slide-in-from-left-1/2 data-[open]:slide-in-from-top-[48%] data-[closed]:fill-mode-forwards sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-default disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
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

function DialogTitle({ className, ...props }: StyledProps<DialogTitleProps>) {
  return (
    <BaseDialog.Title
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
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
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
