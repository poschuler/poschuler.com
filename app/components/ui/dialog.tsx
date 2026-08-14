import {
  Dialog as BaseDialog,
  type DialogPopupProps,
  type DialogTitleProps,
} from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "~/lib/utils";

const Dialog = BaseDialog.Root;

type StyledProps<Props> = Omit<Props, "className"> & { className?: string };

/**
 * A modal centred over the page. Today it holds one thing: the command palette.
 *
 * **The popup does not move on entry, and that is the rule rather than an
 * omission.** A panel earns an entrance when the direction it comes from
 * carries information — a Sheet sliding in from the right says the page is
 * still there, behind it. This arrives in the middle of the viewport, from no
 * edge, so a slide would say nothing and a zoom would be decoration. It also
 * autofocuses a search input, and a couple of hundred milliseconds of entrance
 * is a couple of hundred milliseconds competing with the first keystroke.
 *
 * The scrim still fades, because the dimming is the part that carries meaning:
 * it is what says the page is underneath rather than gone.
 */
function DialogContent({
  className,
  children,
  ...props
}: StyledProps<DialogPopupProps>) {
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
          "-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg gap-4 border border-default bg-app p-6 shadow-lg focus:outline-none sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-default">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

function DialogTitle({ className, ...props }: StyledProps<DialogTitleProps>) {
  return (
    <BaseDialog.Title
      className={cn(
        "font-semibold text-lg leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export { Dialog, DialogContent, DialogTitle };
