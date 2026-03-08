/**
 * Divider — linea orizzontale o verticale. Portato da DS, normalizzato (Tailwind).
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Orientamento della linea */
  orientation?: "horizontal" | "vertical";
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" && "h-px w-full",
        orientation === "vertical" && "h-full w-px min-h-[1em]",
        className
      )}
      data-testid="divider"
      {...props}
    />
  )
);
Divider.displayName = "Divider";

export { Divider };
