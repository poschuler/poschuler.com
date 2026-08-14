import {
  Dialog as BaseDialog,
  type DialogPopupProps,
} from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "~/lib/utils";

const Sheet = BaseDialog.Root;
const SheetTrigger = BaseDialog.Trigger;
const SheetClose = BaseDialog.Close;

type StyledProps<Props> = Omit<Props, "className"> & { className?: string };

/**
 * A panel that slides in from the right over the page, dismissed by the scrim,
 * the X or Escape.
 *
 * Motion is a **transition**, not a keyframe animation, and the difference is
 * what happens to a reader who closes the panel while it is still opening: a
 * transition is interruptible, so it slides back from wherever it actually is,
 * where an animation would restart from the far edge and jump. It also removes
 * the `animation-fill-mode` trap entirely — a transition's end state is the
 * element's own style, so there is nothing to hold after it finishes.
 *
 * Base UI marks the two ends with `data-starting-style` and
 * `data-ending-style`; the base class list carries the resting state, and those
 * two variants carry the off-screen one.
 *
 * One side, because one side is what the site opens: the mobile navigation.
 * The panel arrives from the right, where its trigger sits.
 */
function SheetContent({
  title,
  className,
  children,
  ...props
}: StyledProps<DialogPopupProps> & {
  /**
   * Required rather than optional: a dialog with no accessible name is one a
   * screen reader announces as nothing. Rendered as the `Dialog.Title` and
   * visually hidden, because the panel's content is a labelled nav and a
   * visible heading above it would only repeat what the links already say.
   */
  title: string;
}) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-overlay",
          "transition-opacity duration-panel ease-panel",
          "data-ending-style:duration-panel-out data-ending-style:ease-in",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
          "motion-reduce:transition-none",
        )}
      />
      <BaseDialog.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-3/4 flex-col gap-4 border-default border-l bg-subtle p-6 shadow-lg focus:outline-none sm:max-w-sm",
          "transition-transform duration-panel ease-panel",
          "data-ending-style:duration-panel-out data-ending-style:ease-in",
          "data-starting-style:translate-x-full data-ending-style:translate-x-full",
          "motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
        {children}
        <BaseDialog.Close className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-default">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
