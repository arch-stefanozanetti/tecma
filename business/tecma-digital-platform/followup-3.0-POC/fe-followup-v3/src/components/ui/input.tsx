/**
 * Input — DS Tecma Software Suite (Figma).
 * Text Input: Size=Small|Medium|Large, State=Default|Focus, Show invalid.
 * @see nodes 271-7558, 278-7900, 1215-14807 (Text Input variants)
 * Se usato dentro FormField, usa useFormField() per id, aria-describedby, invalid.
 */
import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { useFormField } from "./form-field";

const inputSizeClasses = {
  sm: "h-8 px-3 py-1.5 text-sm",
  default: "h-10 px-4 py-2.5 text-sm",
  lg: "h-11 px-4 py-3.5 text-sm",
} as const;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Size from DS: Small, Medium (default), Large */
  inputSize?: keyof typeof inputSizeClasses;
  /** Error state: red border and optional exclamation icon */
  invalid?: boolean;
  /** Show error icon on the right when invalid (DS Show invalid=True) */
  showErrorIcon?: boolean;
  /** Optional trailing element (e.g. icon button for password visibility) */
  endAdornment?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      inputSize = "default",
      invalid: invalidProp,
      showErrorIcon = true,
      endAdornment,
      id: idProp,
      "aria-describedby": ariaDescribedByProp,
      "aria-invalid": ariaInvalidProp,
      ...props
    },
    ref
  ) => {
    const field = useFormField();
    const id = idProp ?? field?.id;
    const invalid = invalidProp ?? field?.invalid;
    const ariaDescribedBy = ariaDescribedByProp ?? field?.helperId;
    const ariaInvalid = ariaInvalidProp ?? invalid;

    const base =
      "flex w-full rounded-lg border bg-background font-body transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium";
    const border = invalid
      ? "border-destructive focus-visible:ring-destructive"
      : "border-input shadow-sm";
    const sizeClass = inputSizeClasses[inputSize];

    if (endAdornment || (invalid && showErrorIcon)) {
      return (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-background font-body pl-4 pr-3",
            sizeClass,
            border,
            "has-[:focus]:ring-1 has-[:focus]:ring-ring has-[:focus]:outline-none",
            invalid && "has-[:focus]:ring-destructive",
            className
          )}
        >
          <input
            type={type}
            ref={ref}
            id={id}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            {...props}
          />
          {invalid && showErrorIcon && (
            <AlertCircle
              className="h-5 w-5 shrink-0 text-destructive"
              aria-hidden
            />
          )}
          {endAdornment}
        </div>
      );
    }

    return (
      <input
        type={type}
        ref={ref}
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={cn(base, border, sizeClass, className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputSizeClasses };
