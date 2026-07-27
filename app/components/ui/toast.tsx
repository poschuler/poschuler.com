import {
  Toast as BaseToast,
  type ToastActionProps,
  type ToastCloseProps,
  type ToastDescriptionProps,
  type ToastRootProps,
  type ToastTitleProps,
  type ToastViewportProps,
} from "@base-ui/react/toast";
import { X } from "lucide-react";

import { cn } from "~/lib/utils";

type StyledProps<Props> = Omit<Props, "className"> & { className?: string };

const ToastProvider = BaseToast.Provider;
const ToastPortal = BaseToast.Portal;

function ToastViewport({
  className,
  ...props
}: StyledProps<ToastViewportProps>) {
  return (
    <BaseToast.Viewport
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Variants ride on the toast's `type`, so `add({ type: "destructive" })` is all
 * a caller needs — Base UI reflects it onto `data-type` for every part.
 */
function Toast({ className, ...props }: StyledProps<ToastRootProps>) {
  return (
    <BaseToast.Root
      className={cn(
        /* Base */
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg",
        "border border-default bg-app text-foreground",
        "data-[type=destructive]:border-destructive data-[type=destructive]:bg-destructive data-[type=destructive]:text-destructive-foreground",
        /* Transitions: enter from the top on mobile, from the bottom on desktop */
        "transition-all duration-300 ease-out",
        "data-[starting-style]:-translate-y-full data-[starting-style]:opacity-0",
        "sm:data-[starting-style]:translate-y-full",
        /* Exit to the right, matching the swipe direction */
        "data-[ending-style]:translate-x-full data-[ending-style]:opacity-0",
        /* The pointer drives the transform while swiping */
        "data-[swiping]:transition-none",
        className,
      )}
      {...props}
    />
  );
}

function ToastAction({ className, ...props }: StyledProps<ToastActionProps>) {
  return (
    <BaseToast.Action
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
        "data-[type=destructive]:border-muted/40 data-[type=destructive]:hover:border-destructive/30 data-[type=destructive]:hover:bg-destructive data-[type=destructive]:hover:text-destructive-foreground data-[type=destructive]:focus:ring-destructive",
        className,
      )}
      {...props}
    />
  );
}

function ToastClose({ className, ...props }: StyledProps<ToastCloseProps>) {
  return (
    <BaseToast.Close
      className={cn(
        "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100",
        "data-[type=destructive]:text-red-300 data-[type=destructive]:hover:text-red-50 data-[type=destructive]:focus:ring-red-400",
        className,
      )}
      aria-label="Close"
      {...props}
    >
      <X className="h-4 w-4" />
    </BaseToast.Close>
  );
}

function ToastTitle({ className, ...props }: StyledProps<ToastTitleProps>) {
  return (
    <BaseToast.Title
      className={cn("text-sm font-semibold [&+div]:text-xs", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: StyledProps<ToastDescriptionProps>) {
  return (
    <BaseToast.Description
      className={cn("text-sm opacity-90", className)}
      {...props}
    />
  );
}

export {
  ToastProvider,
  ToastPortal,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
