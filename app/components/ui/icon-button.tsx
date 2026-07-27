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
    "disabled:opacity-disabled",
    /* Group */
    "group-[]/button-group:rounded-none group-[]/button-group:first:rounded-l-lg group-[]/button-group:last:rounded-r-lg",
  ),
  {
    variants: {
      variant: {
        contained: "",
        outline: "",
      },
      color: {
        neutral: "",
        danger: "",
        success: "",
      },
    },
    /* Only the pairs the site actually renders carry styles. */
    compoundVariants: [
      {
        variant: "contained",
        color: "neutral",
        className:
          "bg-ui/60 text-low hover:border-hover hover:bg-ui hover:text focus-visible:ring-default",
      },
      {
        variant: "outline",
        color: "neutral",
        className:
          "text-low hover:border-hover active:bg-active active:text aria-pressed:bg-active aria-pressed:text focus-visible:ring-default",
      },
      {
        variant: "outline",
        color: "danger",
        className:
          "text-danger-low hover:border-danger-hover active:bg-danger-active aria-pressed:bg-danger-active focus-visible:ring-danger",
      },
      {
        variant: "outline",
        color: "success",
        className:
          "text-success-low hover:border-success-hover active:bg-success-active aria-pressed:bg-success-active focus-visible:ring-success",
      },
    ],
    defaultVariants: {
      variant: "outline",
      color: "neutral",
    },
  },
);

export type IconButtonProps = Omit<BaseButton.Props, "className"> &
  VariantProps<typeof iconButtonVariants> & {
    className?: string;
  };

export function IconButton({
  className,
  variant,
  color,
  ...props
}: IconButtonProps) {
  return (
    <BaseButton
      className={cn(iconButtonVariants({ variant, color }), className)}
      {...props}
    />
  );
}

export { iconButtonVariants };
