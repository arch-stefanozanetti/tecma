/**
 * Snackbar — notifica temporanea (portal + Alert). Portato da DS, senza MUI.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { Alert, type AlertVariant } from "./alert";

export type SnackbarAnchorOrigin = {
  vertical: "top" | "bottom";
  horizontal: "left" | "center" | "right";
};

const defaultAnchor: SnackbarAnchorOrigin = {
  vertical: "bottom",
  horizontal: "left",
};

const positionClasses = (anchor: SnackbarAnchorOrigin): string => {
  const v = anchor.vertical === "top" ? "top-4" : "bottom-4";
  const h =
    anchor.horizontal === "left"
      ? "left-4"
      : anchor.horizontal === "right"
        ? "right-4"
        : "left-1/2 -translate-x-1/2";
  return cn("fixed z-50 max-w-md", v, h);
};

export interface SnackbarProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  variant?: AlertVariant;
  anchorOrigin?: SnackbarAnchorOrigin;
  /** ms dopo cui chiudere; 0 = non chiudere automaticamente */
  autoHideDuration?: number;
  /** Azioni (es. bottoni) sotto il contenuto */
  actions?: React.ReactNode;
  className?: string;
}

export function Snackbar({
  open,
  onClose,
  title,
  description,
  variant = "neutral",
  anchorOrigin = defaultAnchor,
  autoHideDuration = 6000,
  actions,
  className,
}: SnackbarProps) {
  React.useEffect(() => {
    if (!open || autoHideDuration <= 0) return;
    const t = window.setTimeout(onClose, autoHideDuration);
    return () => window.clearTimeout(t);
  }, [open, autoHideDuration, onClose]);

  if (!open) return null;

  const content = (
    <div
      className={cn(positionClasses(anchorOrigin), "w-full px-0 sm:max-w-md", className)}
      role="status"
      aria-live="polite"
      data-testid="snackbar"
    >
      <Alert
        variant={variant}
        title={title}
        onClose={onClose}
        action={actions}
      >
        {description}
      </Alert>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
