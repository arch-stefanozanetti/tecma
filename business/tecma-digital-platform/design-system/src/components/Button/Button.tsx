import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "muted"
  | "inverse"
  | "danger"
  | "warning";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  iconOnly?: boolean;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("tecma-button__spinner", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="tecma-button__spinner-circle"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="tecma-button__spinner-path"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      iconOnly = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    const rootClass = cn(
      "tecma-button",
      `tecma-button--${variant}`,
      `tecma-button--${size}`,
      iconOnly && "tecma-button--icon-only",
      className
    );

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={rootClass}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Spinner
            className={cn(!iconOnly && "tecma-button__spinner--offset")}
          />
        )}
        {!loading && leftIcon && (
          <span className="tecma-button__icon-slot">{leftIcon}</span>
        )}
        {!iconOnly && children != null && children !== false && (
          <span
            className={cn(
              "tecma-button__label",
              loading && "tecma-button__label--loading"
            )}
          >
            {children}
          </span>
        )}
        {iconOnly && !loading && children && (
          <span className="tecma-button__icon-slot">{children}</span>
        )}
        {!loading && !iconOnly && rightIcon && (
          <span className="tecma-button__icon-slot">{rightIcon}</span>
        )}
      </button>
    );
  }
);
