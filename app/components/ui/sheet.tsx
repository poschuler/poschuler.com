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
 * The panel owns its own frame — a header bar that does not scroll, and a body
 * that does — rather than handing the caller a bare flex column. That is not
 * decoration: with no bar, the close button had to float `absolute top-4
 * right-4` over whatever the caller put first, which in the one caller was the
 * first navigation link. And with no scroll container, a list longer than the
 * viewport had no way to be reached, while a short one chained its scroll
 * through to the page underneath.
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
   * screen reader announces as nothing. It is also the panel's visible
   * heading — the bar has to exist to give the close button a home, and a bar
   * holding one X and a stretch of nothing is worse than a bar with a label.
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
          "fixed inset-y-0 right-0 z-50 flex w-3/4 flex-col border-default border-l bg-app shadow-lg focus:outline-none sm:max-w-sm",
          "transition-transform duration-panel ease-panel",
          "data-ending-style:duration-panel-out data-ending-style:ease-in",
          "data-starting-style:translate-x-full data-ending-style:translate-x-full",
          "motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-default border-b px-4">
          {/* Renders an `<h2>`, which Tailwind's preflight leaves at inherited
            * size and weight — so it is the same line it looks like, and it is
            * the dialog's accessible name rather than a label beside one. */}
          <BaseDialog.Title className="min-w-0 flex-1 truncate font-semibold text-default">
            {title}
          </BaseDialog.Title>
          <BaseDialog.Close
            aria-label={`Close ${title.toLowerCase()}`}
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-low transition-colors hover:bg-hover hover:text-default focus:outline-none focus-visible:ring-2 focus-visible:ring-default"
          >
            <X className="size-5" aria-hidden />
          </BaseDialog.Close>
        </div>

        {/* `min-h-0` is what lets this shrink inside the flex column at all —
          * without it the body takes its content's height and the panel grows
          * past the viewport instead of scrolling. `overscroll-contain` keeps
          * a flick at the end of the list from scrolling the page behind. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
