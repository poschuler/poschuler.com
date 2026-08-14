import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const iconButtonVariants = cva(
  cn(
    /* Base */
    "flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-transparent p-[7px] text-sm transition [&>*]:size-4",
    /* Focus */
    "focus:outline-none focus-visible:ring-4",
    /* Disabled */
    "disabled:opacity-50",
  ),
  {
    /* Only the variants the site actually renders carry styles. */
    variants: {
      variant: {
        contained:
          "bg-ui/60 text-low hover:border-hover hover:bg-ui hover:text-default focus-visible:ring-default",
        outline:
          "text-low hover:border-hover active:bg-active active:text-default aria-pressed:bg-active aria-pressed:text-default focus-visible:ring-default",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

export type IconButtonProps = Omit<BaseButton.Props, "className"> &
  VariantProps<typeof iconButtonVariants> & {
    className?: string;
  };

export function IconButton({ className, variant, ...props }: IconButtonProps) {
  return (
    <BaseButton
      className={cn(iconButtonVariants({ variant }), className)}
      {...props}
    />
  );
}

