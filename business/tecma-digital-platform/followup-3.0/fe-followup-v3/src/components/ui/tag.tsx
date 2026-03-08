/**
 * Tag — etichetta con optional icon e pulsante dismiss. Portato da DS, normalizzato (Tailwind + Button).
 */
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export interface TagProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Testo del tag */
  label: string;
  /** Icona prima del label (ReactNode, es. lucide-react) */
  icon?: React.ReactNode;
  /** Se true mostra pulsante per rimuovere; richiede onDismiss */
  dismissable?: boolean;
  /** Callback al click su dismiss */
  onDismiss?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  /** Click sull’intero tag (opzionale) */
  onTagClick?: () => void;
}

const Tag = React.forwardRef<HTMLDivElement, TagProps>(
  (
    {
      className,
      label,
      icon,
      dismissable = false,
      onDismiss,
      disabled,
      onTagClick,
      ...props
    },
    ref
  ) => {
    const handleDismiss = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss?.(e);
    };

    const isClickable = Boolean(onTagClick && !disabled);

    return (
      <div
        ref={ref}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? onTagClick : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTagClick?.();
                }
              }
            : undefined
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-sm font-medium text-foreground transition-colors",
          isClickable && "cursor-pointer hover:bg-muted/80",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        data-testid="tag"
        {...props}
      >
        {icon && (
          <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0">{icon}</span>
        )}
        <span className="truncate">{label}</span>
        {dismissable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-sm"
            onClick={handleDismiss}
            disabled={disabled}
            aria-label="Rimuovi"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }
);
Tag.displayName = "Tag";

export { Tag };
