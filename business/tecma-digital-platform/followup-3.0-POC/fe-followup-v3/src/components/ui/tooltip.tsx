/**
 * Tooltip — DS Tecma Software Suite (Figma).
 * Dark box with optional arrow (up / down / left / right). Optional icon dot, second line.
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  /** Trigger element (hover to show) */
  children: React.ReactNode;
  /** Main content (e.g. "Account Settings") */
  content: React.ReactNode;
  /** Optional second line */
  secondLine?: React.ReactNode;
  /** Arrow direction */
  side?: TooltipSide;
  /** Show dot icon before main line */
  showIcon?: boolean;
  className?: string;
}

export function Tooltip({
  children,
  content,
  secondLine,
  side = "top",
  showIcon = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn("relative inline-flex", className)}
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          ref={contentRef}
          role="tooltip"
          className={cn(
            "absolute z-50 flex flex-col gap-1 rounded-chrome bg-foreground px-2 py-1 text-xs font-medium text-primary-foreground shadow-lg",
            side === "top" && "bottom-full left-1/2 mb-1 -translate-x-1/2",
            side === "bottom" && "top-full left-1/2 mt-1 -translate-x-1/2",
            side === "left" && "right-full top-1/2 mr-1 -translate-y-1/2",
            side === "right" && "left-full top-1/2 ml-1 -translate-y-1/2",
          )}
        >
          <div className="flex items-center gap-2">
            {showIcon && (
              <span className="size-2 shrink-0 rounded-full bg-primary-foreground/80" />
            )}
            <span className="leading-tight">{content}</span>
          </div>
          {secondLine != null && (
            <div className="flex items-center gap-2">
              {showIcon && (
                <span className="size-2 shrink-0 rounded-full bg-primary-foreground/80" />
              )}
              <span className="text-[10px] leading-tight opacity-90">
                {secondLine}
              </span>
            </div>
          )}
          {/* Arrow */}
          <div
            className={cn(
              "absolute border-4 border-transparent",
              side === "top" &&
                "left-1/2 top-full -translate-x-1/2 border-t-foreground",
              side === "bottom" &&
                "bottom-full left-1/2 -translate-x-1/2 border-b-foreground",
              side === "left" &&
                "left-full top-1/2 -translate-y-1/2 border-l-foreground",
              side === "right" &&
                "right-full top-1/2 -translate-y-1/2 border-r-foreground",
            )}
          />
        </div>
      )}
    </div>
  );
}
