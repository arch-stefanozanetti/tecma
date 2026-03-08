/**
 * Pagination — DS Tecma Software Suite (Figma).
 * Layouts: Complete (first, prev, pages, next, last), Intermediate (prev, pages, next), Essential (prev, current, next).
 * Page buttons 32px, rounded-chrome. Active page: border + bg.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../../lib/utils";

export type PaginationLayout = "complete" | "intermediate" | "essential";

export interface PaginationProps {
  /** Current page (1-based) */
  page: number;
  /** Total pages */
  totalPages: number;
  /** Layout: complete (first/prev/pages/next/last), intermediate (prev/pages/next), essential (prev/current/next) */
  layout?: PaginationLayout;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

const PAGE_GROUP_SIZE = 5;

function getVisiblePages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }
  if (page >= totalPages - 3) {
    return [1, "ellipsis", ...Array.from({ length: 5 }, (_, i) => totalPages - 4 + i)];
  }
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

export function Pagination({
  page,
  totalPages,
  layout = "complete",
  onPageChange,
  disabled,
  className,
}: PaginationProps) {
  const visiblePages = getVisiblePages(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const navClass = cn(
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-chrome text-foreground transition-colors",
    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    disabled && "pointer-events-none opacity-50",
  );
  const pageClass = (isActive: boolean) =>
    cn(
      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-chrome text-sm font-medium transition-colors",
      isActive
        ? "border border-input bg-background text-foreground shadow-sm"
        : "text-foreground hover:bg-muted",
      !disabled && "cursor-pointer",
      disabled && "opacity-50",
    );

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="navigation"
      aria-label="Paginazione"
    >
      {layout === "complete" && (
        <button
          type="button"
          className={navClass}
          onClick={() => onPageChange(1)}
          disabled={disabled || !canPrev}
          aria-label="Prima pagina"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        className={navClass}
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || !canPrev}
        aria-label="Pagina precedente"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {(layout === "complete" || layout === "intermediate") && (
        <>
          {visiblePages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={pageClass(p === page)}
                onClick={() => onPageChange(p)}
                disabled={disabled}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
        </>
      )}
      {layout === "essential" && (
        <button
          type="button"
          className={pageClass(true)}
          aria-current="page"
          disabled
        >
          {page}
        </button>
      )}

      <button
        type="button"
        className={navClass}
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || !canNext}
        aria-label="Pagina successiva"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {layout === "complete" && (
        <button
          type="button"
          className={navClass}
          onClick={() => onPageChange(totalPages)}
          disabled={disabled || !canNext}
          aria-label="Ultima pagina"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
