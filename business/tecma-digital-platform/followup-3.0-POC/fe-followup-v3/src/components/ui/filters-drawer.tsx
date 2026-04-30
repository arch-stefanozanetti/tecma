/**
 * FiltersDrawer — Drawer filtri ispirato a fe-tecma-followup / fe-coliving.
 * Usa il primitive Drawer centrale: header (titolo + chiudi), content scrollabile, footer (Azzera, Chiudi, Applica).
 */
import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "./drawer";
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side="right"
        size="md"
        className={cn("flex h-full flex-col", className)}
      >
        <DrawerHeader actions={<DrawerCloseButton />}>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="py-0">
          <ScrollArea className="min-h-0 flex-1 py-4">
            <div className="pr-4">{children}</div>
          </ScrollArea>
        </DrawerBody>
        <DrawerFooter className="flex-row flex-wrap items-center gap-2">
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
