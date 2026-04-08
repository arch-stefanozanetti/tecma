/**
 * DateInput — campo data DS: calendario a comparsa (Popover + DayPicker), locale italiana.
 * Compatibile con l’API precedente (`value` / `onChange` come input date).
 */
import * as React from "react";
import { type InputProps } from "./input";
import { DatePickerField } from "./date-picker";

export interface DateInputProps extends Omit<InputProps, "type" | "endAdornment"> {}

const DateInput = React.forwardRef<HTMLButtonElement, DateInputProps>(
  ({ className, value, onChange, disabled, id, inputSize, invalid, min, max, "aria-label": ariaLabel }, ref) => {
    const v = typeof value === "string" ? value : "";
    const handleChange = (next: string) => {
      onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLInputElement>);
    };
    return (
      <DatePickerField
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        value={v}
        onChange={handleChange}
        disabled={disabled}
        invalid={invalid}
        size={inputSize === "sm" ? "sm" : "default"}
        className={className}
        min={typeof min === "string" ? min : undefined}
        max={typeof max === "string" ? max : undefined}
      />
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
