import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "../Icon";
import { cn } from "../../utils/cn";

export type SelectTriggerSize = "sm" | "md" | "lg";

export interface SelectTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  size?: SelectTriggerSize;
  /** Testo mostrato (valore o placeholder) */
  children?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
  readOnly?: boolean;
  open?: boolean;
  /** Contenuto a sinistra (es. icona) */
  leading?: ReactNode;
  /** Suffisso prima del chevron (es. “See all”) */
  suffix?: ReactNode;
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger(
    {
      size = "md",
      children,
      placeholder = "Placeholder",
      invalid,
      readOnly,
      disabled,
      open,
      leading,
      suffix,
      className,
      type = "button",
      ...rest
    },
    ref
  ) {
    const hasValue =
      children != null && children !== false && String(children).trim() !== "";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "tecma-select-trigger",
          size === "sm" && "tecma-select-trigger--sm",
          size === "md" && "tecma-select-trigger--md",
          size === "lg" && "tecma-select-trigger--lg",
          invalid && "tecma-select-trigger--invalid",
          readOnly && "tecma-select-trigger--readonly",
          disabled && "tecma-select-trigger--disabled",
          open && "tecma-select-trigger--open",
          className
        )}
        aria-haspopup="listbox"
        aria-expanded={open ?? undefined}
        {...rest}
      >
        {leading}
        <span
          className={cn(
            "tecma-select-trigger__value",
            !hasValue && "tecma-select-trigger__value--placeholder"
          )}
        >
          {hasValue ? children : placeholder}
        </span>
        {suffix}
        <span className="tecma-select-trigger__chevron" aria-hidden>
          <Icon name="chevron-down" size="sm" />
        </span>
      </button>
    );
  }
);
