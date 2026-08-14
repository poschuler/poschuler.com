import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

/**
 * The site's one button.
 *
 * It was two — a `Button` and an `IconButton` — with overlapping variant names
 * that meant different things in each: `outline` was a bordered button in one
 * file and a borderless one in the other. Three call sites do not need two
 * components, and the pair guaranteed that a change to how a button focuses
 * would be made in one of them.
 *
 * Variants are named after what the button IS on the page, not after the
 * classes it sets, and there are three because the site renders three:
 *
 *  - `outline` — a bordered control that reads as pressable at rest. The
 *    mobile navigation trigger, which has to be findable in a header.
 *  - `soft`    — a filled, quiet control. The Resume's ⌘J affordance, which
 *    should be noticed once and then ignored.
 *  - `ghost`   — nothing at rest, a border on hover. The theme toggle, which
 *    sits inside a row of links and should not outweigh them.
 */
const button = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md border font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-default disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline: "border-default bg-app shadow-sm hover:bg-hover",
        soft: "border-transparent bg-ui text-low shadow-sm hover:bg-hover hover:text-default",
        ghost:
          "border-transparent text-low hover:border-hover active:bg-active active:text-default aria-pressed:bg-active aria-pressed:text-default",
      },
      size: {
        sm: "h-8 px-3",
        /* 44px up to `lg`, 36px above it. 44 is the smaller of the two
         * touch-target minimums (iOS 44pt, Android 48dp); a pointer needs
         * neither, and at 44 a control starts to look like a button on a
         * toolbar rather than a word in a row. The switch is `lg` because that
         * is where the header stops being a touch surface and becomes a row of
         * links — see `routes/layouts/header.tsx`. */
        icon: "size-11 lg:size-9",
      },
    },
    defaultVariants: {
      variant: "soft",
      size: "sm",
    },
  },
);

export type ButtonProps = Omit<BaseButton.Props, "className"> &
  VariantProps<typeof button> & {
    /**
     * Narrowed to a string: Base UI also accepts a function of the button's
     * state here, which `cn` cannot merge.
     */
    className?: string;
  };

/**
 * To compose the button with another element — a link, a dialog trigger — pass
 * that element through `render` instead of nesting it:
 * `<Button render={<Link to="/blog" />}>blog</Button>`.
 */
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  );
}
