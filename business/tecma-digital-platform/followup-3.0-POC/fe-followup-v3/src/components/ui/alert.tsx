/**
 * Alert — DS Tecma Software Suite (Figma).
 * Semantic types: neutral, info, success, warning, error. Title, optional content, optional action, optional close.
 */
import * as React from "react";
import { AlertCircle, CheckCircle, Info, Smile, Triangle, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type AlertVariant = "neutral" | "info" | "success" | "warning" | "error";

const variantStyles: Record<AlertVariant, string> = {
  neutral: "bg-muted border-border text-foreground",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-destructive/10 border-destructive/30 text-destructive",
};

const variantIcons: Record<AlertVariant, React.ElementType> = {
  neutral: Smile,
  info: Info,
  success: CheckCircle,
  warning: Triangle,
  error: AlertCircle,
};

export interface AlertProps {
  variant?: AlertVariant;
  title: React.ReactNode;
  /** Optional body text */
  children?: React.ReactNode;
  /** Optional action link/button (left-aligned below content) */
  action?: React.ReactNode;
  /** Optional onClose; when set, shows close button */
  onClose?: () => void;
  className?: string;
}

export function Alert({
  variant = "neutral",
  title,
  children,
  action,
  onClose,
  className,
}: AlertProps) {
  const containerClass = variantStyles[variant];
  const Icon = variantIcons[variant];
  const iconColor =
    variant === "neutral" ? "text-muted-foreground" : "currentColor";

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-md border px-4 py-3 text-sm",
        containerClass,
        className
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-5">{title}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {children && (
          <p className="mt-1 font-normal leading-5 opacity-90">{children}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
