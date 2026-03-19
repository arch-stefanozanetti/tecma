import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export type SelectItemLayout =
  | "text"
  | "checkEnd"
  | "checkboxStart"
  | "checkboxEnd";

export interface SelectItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  description?: string;
  layout?: SelectItemLayout;
  /** Voce selezionata (check finale o checkbox checked) */
  selected?: boolean;
  invalid?: boolean;
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} aria-hidden>
      <path
        d="M2.5 6 L5 8.5 L9.5 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrailCheck() {
  return (
    <svg
      className="tecma-select-item__check-svg"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M2.5 6 L5 8.5 L9.5 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="tecma-select-item__error-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 4.5V9M8 11v.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Atomo voce lista — Figma 5057:1604 (testo, check trailing, checkbox prima/dopo).
 */
export function SelectItem({
  children,
  description,
  layout = "text",
  selected = false,
  disabled,
  invalid,
  className,
  type = "button",
  role = "option",
  "aria-selected": ariaSelected,
  ...rest
}: SelectItemProps) {
  const showCheckEnd = layout === "checkEnd" && selected;
  const cbStart = layout === "checkboxStart";
  const cbEnd = layout === "checkboxEnd";
  const showCheckbox = cbStart || cbEnd;
  const checked = showCheckbox && selected;

  const body = (
    <span className="tecma-select-item__body">
      <span className="tecma-select-item__title">{children}</span>
      {description ? (
        <span className="tecma-select-item__desc">{description}</span>
      ) : null}
    </span>
  );

  const checkboxEl = showCheckbox ? (
    <span
      className={cn(
        "tecma-select-item__checkbox",
        invalid && checked && "tecma-select-item__checkbox--invalid"
      )}
      aria-hidden
    >
      {checked ? <CheckGlyph /> : null}
    </span>
  ) : null;

  return (
    <button
      type={type}
      role={role}
      disabled={disabled}
      aria-selected={ariaSelected ?? selected}
      className={cn(
        "tecma-select-item",
        (layout === "text" || layout === "checkEnd") &&
          "tecma-select-item--layout-text",
        cbStart && "tecma-select-item--layout-checkbox-start",
        cbEnd && "tecma-select-item--layout-checkbox-end",
        selected &&
          layout === "checkEnd" &&
          "tecma-select-item--selected",
        checked && showCheckbox && "tecma-select-item--checked",
        disabled && "tecma-select-item--disabled",
        invalid && "tecma-select-item--invalid",
        className
      )}
      {...rest}
    >
      {invalid && layout === "checkEnd" && selected ? <ErrorIcon /> : null}
      {cbStart ? checkboxEl : null}
      {body}
      {cbEnd ? checkboxEl : null}
      {showCheckEnd ? (
        <span className="tecma-select-item__trail">
          <TrailCheck />
        </span>
      ) : null}
    </button>
  );
}
