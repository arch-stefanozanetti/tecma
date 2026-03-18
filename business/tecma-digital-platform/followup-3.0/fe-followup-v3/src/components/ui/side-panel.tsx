import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  type DrawerContentProps,
} from "./drawer";
import {
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  type SheetContentProps,
} from "./sheet";

export type SidePanelVariant = "operational" | "preview" | "navigation";
export type SidePanelSize = "sm" | "md" | "lg" | "xl" | "full";

const SidePanelContext = React.createContext<{ variant: SidePanelVariant }>({
  variant: "operational",
});

const sizeToClassName: Record<SidePanelSize, string> = {
  sm: "w-full sm:max-w-sm",
  md: "w-full sm:max-w-md",
  lg: "w-full sm:max-w-lg",
  xl: "w-full sm:max-w-xl",
  full: "w-full max-w-none",
};

export interface SidePanelContentProps {
  side?: "left" | "right";
  size?: SidePanelSize;
  className?: string;
  children: React.ReactNode;
}

export interface SidePanelProps extends React.ComponentPropsWithoutRef<typeof Drawer> {
  variant: SidePanelVariant;
}

export function SidePanel({ variant, children, ...props }: SidePanelProps) {
  const contextValue = React.useMemo(() => ({ variant }), [variant]);
  return (
    <SidePanelContext.Provider value={contextValue}>
      <Drawer {...props}>{children}</Drawer>
    </SidePanelContext.Provider>
  );
}

export function SidePanelContent({
  side = "right",
  size = "md",
  className,
  children,
}: SidePanelContentProps) {
  const { variant } = React.useContext(SidePanelContext);

  if (variant === "operational") {
    return (
      <DrawerContent side={side} size={size} className={className}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <SheetContent aria-describedby={undefined} side={side} className={cn(sizeToClassName[size], className)}>
      {children}
    </SheetContent>
  );
}

export function SidePanelHeader({
  className,
  actions,
  children,
}: React.HTMLAttributes<HTMLDivElement> & { actions?: React.ReactNode }) {
  const { variant } = React.useContext(SidePanelContext);
  if (variant === "operational") {
    return (
      <DrawerHeader className={className} actions={actions}>
        {children}
      </DrawerHeader>
    );
  }
  return (
    <SheetHeader className={cn("border-b border-border px-6 pt-5 pb-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 pr-4">{children}</div>
        {actions}
      </div>
    </SheetHeader>
  );
}

export function SidePanelTitle({
  className,
  children,
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { variant } = React.useContext(SidePanelContext);
  if (variant === "operational") {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }
  return <SheetTitle className={cn("text-base font-bold", className)}>{children}</SheetTitle>;
}

export function SidePanelBody({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = React.useContext(SidePanelContext);
  if (variant === "operational") {
    return <DrawerBody className={className}>{children}</DrawerBody>;
  }
  return <SheetBody className={cn("px-6 py-4", className)}>{children}</SheetBody>;
}

export function SidePanelFooter({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = React.useContext(SidePanelContext);
  if (variant === "operational") {
    return <DrawerFooter className={className}>{children}</DrawerFooter>;
  }
  return <SheetFooter className={cn("border-t border-border px-6 py-4", className)}>{children}</SheetFooter>;
}

export function SidePanelClose({ className }: { className?: string }) {
  const { variant } = React.useContext(SidePanelContext);
  if (variant === "operational") return <DrawerCloseButton className={className} />;

  return (
    <SheetClose
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-chrome text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
    >
      <X className="h-5 w-5" />
      <span className="sr-only">Chiudi</span>
    </SheetClose>
  );
}

export { DrawerClose as SidePanelClosePrimitive, SheetClose as SidePanelSheetClosePrimitive };
export type { DrawerContentProps, SheetContentProps };
