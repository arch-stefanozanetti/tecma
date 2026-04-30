/**
 * Progress Bar — DS Tecma Software Suite (Figma).
 * Horizontal bar with optional label (percentage). Value 0–100.
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value 0–100 */
  value?: number;
  /** Show percentage label (right-aligned) */
  showLabel?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, showLabel = true, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        className={cn("flex w-full flex-col gap-2", className)}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        {showLabel && (
          <p className="text-xs font-medium leading-tight text-foreground">
            {Math.round(clamped)}%
          </p>
        )}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
