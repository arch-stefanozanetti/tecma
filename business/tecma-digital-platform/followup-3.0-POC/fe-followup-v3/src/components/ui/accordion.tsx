/**
 * Accordion — DS Tecma Software Suite (Figma).
 * Single or multiple items, Flat or Border type. Title + chevron, optional "See all" / "See less".
 */
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

export type AccordionType = "flat" | "border";

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Flat (no border) or border. Default flat. */
  type?: AccordionType;
  disabled?: boolean;
  /** Optional "See all" link when expanded */
  actionOpen?: React.ReactNode;
  /** Optional "See less" link when expanded */
  actionClose?: React.ReactNode;
  className?: string;
}

export function AccordionItem({
  title,
  children,
  open = false,
  onOpenChange,
  type = "flat",
  disabled,
  actionOpen,
  actionClose,
  className,
}: AccordionItemProps) {
  const isBorder = type === "border";
  return (
    <div
      className={cn(
        "bg-background",
        isBorder && "rounded-chrome border border-border",
        className
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-4 px-4 py-4 text-left font-bold text-foreground transition-colors",
          "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:text-muted-foreground",
        )}
        onClick={() => onOpenChange?.(!open)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 text-base leading-tight">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground" />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4 pt-0">
          {children}
          {actionOpen != null && (
            <div className="flex justify-center py-4">{actionOpen}</div>
          )}
          {actionClose != null && (
            <div className="flex justify-center py-4">{actionClose}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-0 [&>*]:border-b [&>*]:border-border [&>*:last-child]:border-b-0",
        className
      )}
    >
      {children}
    </div>
  );
}
