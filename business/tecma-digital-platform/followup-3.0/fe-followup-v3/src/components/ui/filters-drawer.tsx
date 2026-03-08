/**
 * FiltersDrawer — Drawer filtri ispirato a fe-tecma-followup / fe-coliving.
 * Sheet da destra: header (titolo + chiudi), content scrollabile, footer (Azzera, Chiudi, Applica).
 */
import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "./sheet";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";
import { cn } from "../../lib/utils";

export interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onReset?: () => void;
  onApply?: () => void;
  /** Testo pulsante Applica (default "Applica") */
  applyLabel?: string;
  /** Disabilita Applica quando non ci sono modifiche (opzionale) */
  applyDisabled?: boolean;
  className?: string;
}

export function FiltersDrawer({
  open,
  onOpenChange,
  title,
  children,
  onReset,
  onApply,
  applyLabel = "Applica",
  applyDisabled = false,
  className,
}: FiltersDrawerProps) {
  const handleApply = () => {
    onApply?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex h-full w-full max-w-md flex-col sm:max-w-md", className)}
      >
        <SheetHeader className="flex-shrink-0 border-b border-border pb-4">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {title}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 py-4">
          <div className="pr-4">{children}</div>
        </ScrollArea>
        <SheetFooter className="flex-shrink-0 flex-row flex-wrap gap-2 border-t border-border pt-4">
          {onReset && (
            <Button
              variant="ghost"
              className="order-2 sm:order-1 text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              Azzera
            </Button>
          )}
          <div className="flex flex-1 justify-end gap-2 order-1 sm:order-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
            {onApply && (
              <Button onClick={handleApply} disabled={applyDisabled}>
                {applyLabel}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
