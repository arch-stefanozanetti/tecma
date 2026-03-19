import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../utils/cn";

export type CheckboxSize = "sm" | "md" | "lg";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** sm 16px, md 24px, lg 32px (Figma Checkbox) */
  size?: CheckboxSize;
  /** Stato errore / invalid (bordo danger) */
  invalid?: boolean;
  /** Come disabled visivo (Figma read-only) */
  readOnly?: boolean;
}

const checkDim: Record<CheckboxSize, number> = {
  sm: 10,
  md: 14,
  lg: 18,
};

function CheckGlyph({ size }: { size: CheckboxSize }) {
  const d = checkDim[size];
  return (
    <svg
      className="tecma-checkbox__glyph"
      width={d}
      height={d}
      viewBox="0 0 12 12"
      aria-hidden
    >
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

/**
 * Checkbox DS Tecma — [Figma 40:275](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=40-275)
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      size = "md",
      invalid = false,
      readOnly = false,
      disabled,
      className,
      id: idProp,
      children,
      ...rest
    },
    ref
  ) {
    const uid = useId();
    const id = idProp ?? `tecma-cb-${uid}`;
    const isInactive = Boolean(disabled || readOnly);

    const rootClass = cn(
      "tecma-checkbox",
      size === "sm" && "tecma-checkbox--sm",
      size === "md" && "tecma-checkbox--md",
      size === "lg" && "tecma-checkbox--lg",
      invalid && !isInactive && "tecma-checkbox--invalid",
      disabled && "tecma-checkbox--disabled",
      readOnly && "tecma-checkbox--read-only",
      className
    );

    return (
      <label className={rootClass} htmlFor={id}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="tecma-checkbox__input"
          disabled={disabled || readOnly}
          aria-invalid={invalid || undefined}
          {...rest}
        />
        <span className="tecma-checkbox__box">
          <CheckGlyph size={size} />
        </span>
        {children != null && children !== false && (
          <span className="tecma-checkbox__label">{children}</span>
        )}
      </label>
    );
  }
);
