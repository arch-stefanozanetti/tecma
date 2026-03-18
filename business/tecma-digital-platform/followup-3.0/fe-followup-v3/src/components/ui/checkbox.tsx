/**
 * Checkbox — DS Tecma Software Suite (Figma).
 * Variants: accent (primary when checked) | muted (light fill when checked).
 * Size: sm (16px) | default (24px). States: default, disabled, invalid.
 * @see nodes 40-269..40-274, 114-3744..114-3872, 315-10853..315-10874, 9551-136560..
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

const sizeClasses = {
  sm: "h-4 w-4 rounded-md",
  default: "h-6 w-6 rounded-md",
} as const;

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Visual variant: accent = primary fill when checked, muted = light fill */
  variant?: "accent" | "muted";
  /** Size: sm = 16px, default = 24px */
  size?: keyof typeof sizeClasses;
  /** Checked state */
  checked?: boolean;
  /** Error state: red border (DS Invalid) */
  invalid?: boolean;
  /** Callback when checked state changes (controlled or for accessibility) */
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      className,
      variant = "accent",
      size = "sm",
      checked = false,
      disabled = false,
      invalid = false,
      onCheckedChange,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const sizeClass = sizeClasses[size];
    const isDisabled = disabled;

    const boxClasses = cn(
      "inline-flex shrink-0 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
      sizeClass,
      isDisabled &&
        "border-muted bg-muted cursor-not-allowed opacity-100",
      !isDisabled && !checked && "border-input bg-background",
      !isDisabled && checked && variant === "accent" && "border-primary bg-primary",
      !isDisabled && checked && variant === "muted" &&
        "border-foreground/20 bg-accent/10 text-foreground",
      invalid && "ring-2 ring-destructive ring-offset-0 border-destructive",
      className
    );

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        disabled={isDisabled}
        className={boxClasses}
        data-name="Checkbox"
        onClick={() => onCheckedChange?.(!checked)}
      >
        {checked ? (
          <Check
            className={cn(
              size === "sm" ? "h-3 w-3" : "h-4 w-4",
              variant === "accent" && "text-primary-foreground",
              variant === "muted" && "text-foreground"
            )}
            strokeWidth={2.5}
            aria-hidden
          />
        ) : null}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";

export interface CheckboxWithLabelProps
  extends Omit<CheckboxProps, "aria-label"> {
  /** Label text next to the checkbox */
  label: React.ReactNode;
  /** Show "(optional)" below the label */
  showOptional?: boolean;
  /** Show "Required" error text below the label (red) */
  showRequiredError?: boolean;
  /** Id for the label (links to checkbox for a11y) */
  id?: string;
}

const CheckboxWithLabel = React.forwardRef<HTMLButtonElement, CheckboxWithLabelProps>(
  (
    {
      className,
      label,
      showOptional = false,
      showRequiredError = false,
      id: idProp,
      ...checkboxProps
    },
    ref
  ) => {
    const id = idProp ?? React.useId();
    const checkboxRef = React.useRef<HTMLButtonElement>(null);
    React.useImperativeHandle(ref, () => checkboxRef.current!);

    return (
      <div
        className={cn("flex items-start gap-4", className)}
        data-name="Checkbox (With label)"
        role="group"
      >
        <div className="flex items-center pt-0.5">
          <Checkbox
            ref={checkboxRef}
            id={id}
            aria-labelledby={`${id}-label`}
            aria-label={typeof label === "string" ? label : undefined}
            {...checkboxProps}
          />
        </div>
        <div
          id={`${id}-label`}
          role="presentation"
          className="flex cursor-pointer flex-col gap-0 pt-0.5 select-none"
          onClick={() => checkboxRef.current?.click()}
        >
          <span className="font-body text-sm font-normal leading-5 text-foreground">
            {label}
          </span>
          {showOptional && (
            <span className="font-body text-xs font-medium leading-[17px] text-muted-foreground">
              (optional)
            </span>
          )}
          {showRequiredError && (
            <span className="font-body text-xs font-medium leading-[17px] text-destructive">
              Required
            </span>
          )}
        </div>
      </div>
    );
  }
);
CheckboxWithLabel.displayName = "CheckboxWithLabel";

export { Checkbox, CheckboxWithLabel };
