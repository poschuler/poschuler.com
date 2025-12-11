import { type HTMLProps } from "react";
import { clsx } from "clsx";

type CardProps = HTMLProps<HTMLDivElement> & {
  intent?: "danger";
};

export const Card = ({ className, intent, ...props }: CardProps) => {
  return (
    <div
      className={clsx(
        className,
        intent,
        "bg-app overflow-hidden rounded-lg border shadow",
        intent === "danger"
          ? "border-danger-hover bg-danger-ui"
          : "border-default"
      )}
      {...props}
    />
  );
};

export const CardBody = (props: HTMLProps<HTMLDivElement>) => {
  return <div className="font-ms p-4" {...props} />;
};

export const CardFooter = ({ className, intent, ...props }: CardProps) => {
  return (
    <div
      className={clsx(
        "border-t p-4 text-sm",
        intent === "danger"
          ? "border-danger-hover bg-danger-ui"
          : "border-default bg-subtle",
        className
      )}
      {...props}
    />
  );
};

export const CardTitle = (props: HTMLProps<HTMLDivElement>) => {
  return <h2 className="mb-4 text-xl font-semibold" {...props} />;
};

export const CardParagraph = ({
  className,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  return <div className={clsx(className, "my-4 last:mb-0")} {...props} />;
};

export const CardSeparator = ({
  className,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={clsx(className, "border-t border-default")}
      {...props}
    />
  );
};
