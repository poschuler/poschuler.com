import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-default disabled:pointer-events-none disabled:opacity-50",
  {
    /* Only the variants and sizes the site actually renders carry styles. */
    variants: {
      variant: {
        outline: "border border-default bg-app shadow-sm hover:bg-hover",
        secondary: "bg-ui text-low shadow-sm hover:bg-hover hover:text-default",
      },
      size: {
        default: "h-9 px-4 py-2",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

export type ButtonProps = Omit<BaseButton.Props, "className"> &
  VariantProps<typeof buttonVariants> & {
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
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
