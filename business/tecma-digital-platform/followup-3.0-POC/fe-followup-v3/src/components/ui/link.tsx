/**
 * Link — DS Tecma Software Suite (Figma).
 * Sizes: Small (12px), Regular (14px). States: Default, Hover, Pressed, Focus, Disabled.
 * Optional icon before/after.
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export type LinkSize = "sm" | "regular";

export interface LinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  size?: LinkSize;
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
}

const sizeClasses: Record<LinkSize, string> = {
  sm: "text-xs leading-[17px]",
  regular: "text-sm leading-5",
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      className,
      size = "regular",
      iconBefore,
      iconAfter,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClass = sizeClasses[size];
    const iconSize = "h-5 w-5 shrink-0";

    return (
      <a
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1 font-normal text-primary underline underline-offset-2 decoration-solid",
          "hover:text-primary/80 active:text-primary/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-chrome",
          "disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline",
          sizeClass,
          className
        )}
        {...props}
      >
        {iconBefore && <span className={iconSize}>{iconBefore}</span>}
        {children}
        {iconAfter && <span className={iconSize}>{iconAfter}</span>}
      </a>
    );
  }
);
Link.displayName = "Link";

export { Link };
