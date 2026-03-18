/**
 * Drawer — DS Tecma (Figma 1306-19246). Pannello laterale 400px con header, content, footer.
 * Basato su Sheet (Radix Dialog); overlay blanket, header con titolo/subtitle/close, slot content, footer con azioni e optional Delete.
 */
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";

const Drawer = SheetPrimitive.Root;
const DrawerTrigger = SheetPrimitive.Trigger;
const DrawerClose = SheetPrimitive.Close;
const DrawerPortal = SheetPrimitive.Portal;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  /** Lato di apertura (default right) */
  side?: "left" | "right";
  /** Size standardizzato del pannello (default "md") */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  DrawerContentProps
>(({ side = "right", size = "md", className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <SheetPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(
        "fixed inset-y-0 z-50 flex h-full w-full flex-col bg-background shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
        size === "sm" && "min-w-[320px] max-w-[360px]",
        size === "md" && "min-w-[360px] max-w-[400px]",
        size === "lg" && "min-w-[400px] max-w-[520px]",
        size === "xl" && "min-w-[420px] max-w-[680px]",
        size === "full" && "w-full max-w-none",
        side === "right" &&
          "right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        side === "left" &&
          "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        className
      )}
      {...props}
    >
      {children}
    </SheetPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Azioni in header (es. bottoni icon close) da mettere a destra */
  actions?: React.ReactNode;
}

const DrawerHeader = React.forwardRef<HTMLDivElement, DrawerHeaderProps>(
  ({ className, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 items-start justify-between gap-2 border-b border-border bg-background px-8 pt-6 pb-4",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 pr-4">{children}</div>
      {actions}
    </div>
  )
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-bold leading-tight tracking-tight text-foreground",
      className
    )}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerSubtitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("mt-0.5 text-sm font-normal leading-tight text-muted-foreground", className)}
    {...props}
  />
));
DrawerSubtitle.displayName = "DrawerSubtitle";

/** Contenuto scrollabile del drawer */
const DrawerBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-4", className)}
    {...props}
  />
));
DrawerBody.displayName = "DrawerBody";

/** Footer con azioni (ButtonGroup) e optional Delete */
const DrawerFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex shrink-0 flex-col gap-4 border-t border-border bg-background px-8 py-6",
      className
    )}
    {...props}
  />
));
DrawerFooter.displayName = "DrawerFooter";

/** Link/button "Delete" in rosso (DS) */
export interface DrawerDeleteProps {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

function DrawerDelete({ onClick, children = "Delete", className }: DrawerDeleteProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-chrome px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Trash2 className="h-5 w-5" aria-hidden />
      {children}
    </button>
  );
}

/** Pulsante "Go back" per top controls */
function DrawerBackButton({
  onClick,
  children = "Go back",
  className,
}: {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-chrome px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <ChevronLeft className="h-4 w-4" />
      {children}
    </button>
  );
}

/** Pulsante close icon per header */
function DrawerCloseButton({ className }: { className?: string }) {
  return (
    <DrawerClose
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-chrome text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
    >
      <X className="h-5 w-5" />
      <span className="sr-only">Chiudi</span>
    </DrawerClose>
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
  DrawerFooter,
  DrawerDelete,
  DrawerBackButton,
  DrawerCloseButton,
};
