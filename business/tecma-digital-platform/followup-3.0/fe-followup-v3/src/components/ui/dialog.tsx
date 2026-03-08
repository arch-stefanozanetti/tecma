import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export type ModalSize = "small" | "medium" | "large" | "mobile";

const modalSizeClasses: Record<ModalSize, string> = {
  small: "max-w-[400px]",
  medium: "max-w-[800px]",
  large: "max-w-[1200px]",
  mobile: "fixed bottom-0 left-0 right-0 top-auto max-h-[90vh] translate-x-0 translate-y-0 rounded-t-lg data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
};

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** DS Modal: size (small 400px, medium 800px, large 1200px, mobile bottom sheet). Omit for default max-w-lg. */
  size?: ModalSize;
  /** When true, the default close button is hidden (use ModalHeader with its own close). */
  hideDefaultClose?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size, hideDefaultClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        size ? modalSizeClasses[size] : "max-w-lg",
        className
      )}
      {...props}
    >
      {children}
      {!hideDefaultClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-chrome opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/** DS Modal header: title, optional subtitle, close button. Use with DialogContent hideDefaultClose. */
export type ModalHeaderVariant = "plain" | "colour" | "image";
export type ModalHeaderSize = "small" | "medium" | "large" | "mobile";

export interface ModalHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  variant?: ModalHeaderVariant;
  size?: ModalHeaderSize;
  onClose?: () => void;
}

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, title, subtitle, variant = "plain", size = "medium", onClose, ...props }, ref) => {
    const sizeClass = size === "small" ? "text-base" : size === "large" ? "text-xl" : size === "mobile" ? "text-lg" : "text-lg";
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-1 text-left",
          variant === "colour" && "rounded-t-lg bg-muted/50 px-6 -mx-6 -mt-6 pt-6 pb-2",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className={cn("font-semibold leading-tight tracking-tight text-foreground", sizeClass)}>
              {title}
            </DialogPrimitive.Title>
            {subtitle && (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {subtitle}
              </DialogPrimitive.Description>
            )}
          </div>
          {onClose && (
            <DialogPrimitive.Close
              onClick={onClose}
              className="shrink-0 rounded-chrome p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Chiudi</span>
            </DialogPrimitive.Close>
          )}
        </div>
      </div>
    );
  }
);
ModalHeader.displayName = "ModalHeader";

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription, ModalHeader };
