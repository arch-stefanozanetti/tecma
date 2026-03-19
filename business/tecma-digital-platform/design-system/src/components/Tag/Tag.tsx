import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type TagVariant =
  | "default"
  | "primary"
  | "accentLight"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type TagAppearance = "outline" | "filled";

export interface TagProps {
  children: ReactNode;
  /** Figma: Default, Primary, Accent light, Info, Success, Warning, Danger */
  variant?: TagVariant;
  /** Contorno + sfondo chiaro vs pieno */
  appearance?: TagAppearance;
  /** Mostra pulsante chiudi (Figma Dismissable) */
  dismissible?: boolean;
  onDismiss?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  /** Intera etichetta cliccabile (layout Clickable) */
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  disabled?: boolean;
  className?: string;
  /** aria-label sul pulsante dismiss */
  dismissLabel?: string;
}

function variantClass(v: TagVariant) {
  const map: Record<TagVariant, string> = {
    default: "tecma-tag--variant-default",
    primary: "tecma-tag--variant-primary",
    accentLight: "tecma-tag--variant-accent-light",
    info: "tecma-tag--variant-info",
    success: "tecma-tag--variant-success",
    warning: "tecma-tag--variant-warning",
    danger: "tecma-tag--variant-danger",
  };
  return map[v];
}

function DismissIcon() {
  return (
    <svg
      className="tecma-tag__dismiss-icon"
      width={12}
      height={12}
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M3 3 L9 9 M9 3 L3 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Tag DS Tecma — [Figma 599:7479](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=599-7479)
 */
export function Tag({
  children,
  variant = "default",
  appearance = "outline",
  dismissible = false,
  onDismiss,
  onClick,
  disabled = false,
  className,
  dismissLabel = "Rimuovi",
}: TagProps) {
  const v = variantClass(variant);
  const app =
    appearance === "filled"
      ? "tecma-tag--appearance-filled"
      : "tecma-tag--appearance-outline";

  const shell = cn(
    "tecma-tag",
    v,
    app,
    disabled && "tecma-tag--disabled",
    className
  );

  /* Solo click, tutto il tag = button */
  if (onClick && !dismissible) {
    return (
      <button
        type="button"
        className={cn(shell, "tecma-tag--interactive")}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  if (dismissible) {
    return (
      <span
        className={cn(shell, "tecma-tag--compound")}
        data-disabled={disabled || undefined}
      >
        {onClick ? (
          <button
            type="button"
            className="tecma-tag__main"
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </button>
        ) : (
          <span className="tecma-tag__label">{children}</span>
        )}
        <button
          type="button"
          className="tecma-tag__dismiss"
          disabled={disabled}
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          <DismissIcon />
        </button>
      </span>
    );
  }

  return <span className={shell}>{children}</span>;
}
