/**
 * Spinner — DS Tecma Software Suite (Figma).
 * Loading indicator: 8 dots in a circle. Sizes: Small (16px), Medium (24px), Large (32px).
 */
import * as React from "react";
import { cn } from "../../lib/utils";

const spinnerSizes = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const;

const dotSizes = {
  sm: "size-0.5",
  md: "size-1",
  lg: "size-1.5",
} as const;

const radiusPx = { sm: 8, md: 12, lg: 16 } as const;

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size from DS: Small (16px), Medium (24px), Large (32px) */
  size?: keyof typeof spinnerSizes;
}

const DOT_COUNT = 8;

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "sm", ...props }, ref) => {
    const containerSize = spinnerSizes[size];
    const dotSize = dotSizes[size];
    const r = radiusPx[size];
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Caricamento"
        className={cn("relative inline-block", containerSize, className)}
        {...props}
      >
        <div className="absolute inset-0 animate-spin">
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <div
              key={i}
              className={cn(
                "absolute left-1/2 top-1/2 origin-center rounded-full bg-foreground -translate-x-1/2 -translate-y-1/2",
                dotSize,
              )}
              style={{
                transform: `rotate(${(360 / DOT_COUNT) * i}deg) translateY(-${r}px)`,
              }}
            />
          ))}
        </div>
        <span className="sr-only">Caricamento...</span>
      </div>
    );
  }
);
Spinner.displayName = "Spinner";

export { Spinner };
