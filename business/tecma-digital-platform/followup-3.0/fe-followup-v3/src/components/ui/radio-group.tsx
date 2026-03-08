/**
 * RadioGroup + Radio — selezione singola. Native input + Tailwind (no Radix per evitare nuova dep).
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export interface RadioGroupContextValue {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null
);

export interface RadioGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Orientamento: riga o colonna */
  orientation?: "horizontal" | "vertical";
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      className,
      name,
      value,
      onChange,
      disabled,
      orientation = "vertical",
      ...props
    },
    ref
  ) => (
    <RadioGroupContext.Provider
      value={{ name, value, onChange, disabled }}
    >
      <div
        ref={ref}
        role="radiogroup"
        className={cn(
          "flex gap-4",
          orientation === "vertical" && "flex-col",
          orientation === "horizontal" && "flex-row",
          className
        )}
        data-testid="radio-group"
        {...props}
      />
    </RadioGroupContext.Provider>
  )
);
RadioGroup.displayName = "RadioGroup";

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "name"> {
  value: string;
  /** Nome del gruppo (usato se Radio è fuori da RadioGroup) */
  name?: string;
  /** Label associato al radio */
  label?: React.ReactNode;
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      className,
      value,
      label,
      id: idProp,
      disabled,
      name,
      onChange: _onChange,
      checked: _checked,
      ...props
    },
    ref
  ) => {
    const ctx = React.useContext(RadioGroupContext);
    const groupName = ctx?.name ?? name ?? "";
    const checked = ctx ? ctx.value === value : _checked;
    const isDisabled = disabled ?? ctx?.disabled;
    const handleChange = ctx?.onChange
      ? () => ctx.onChange?.(value)
      : _onChange;

    const id = idProp ?? React.useId();
    const inputId = `radio-${id}`;
    const labelId = `radio-label-${id}`;

    return (
      <label
        htmlFor={inputId}
        id={labelId}
        className={cn(
          "flex cursor-pointer items-center gap-2 text-sm font-medium leading-none text-foreground",
          isDisabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          ref={ref}
          type="radio"
          id={inputId}
          name={groupName}
          value={value}
          checked={checked}
          disabled={isDisabled}
          onChange={handleChange}
          aria-labelledby={label ? labelId : undefined}
          className="h-4 w-4 rounded-full border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          data-testid="radio"
          {...props}
        />
        {label != null && <span>{label}</span>}
      </label>
    );
  }
);
Radio.displayName = "Radio";

export { RadioGroup, Radio };
