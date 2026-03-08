/**
 * PhoneInput — DS Tecma Software Suite (Figma).
 * Composite: country/prefix selector + number input with optional stepper.
 * @see nodes 7395-26676 (Phone input variants)
 */
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const DEFAULT_PREFIX_OPTIONS = [
  { value: "IT (+39)", label: "IT (+39)" },
  { value: "DE (+49)", label: "DE (+49)" },
  { value: "FR (+33)", label: "FR (+33)" },
  { value: "ES (+34)", label: "ES (+34)" },
  { value: "UK (+44)", label: "UK (+44)" },
];

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  className?: string;
  /** Show prefix selector (left part) */
  showPrefix?: boolean;
  /** Show stepper (up/down) on the number field */
  showStepper?: boolean;
  /** Prefix options for the selector */
  prefixOptions?: { value: string; label: string }[];
  /** Controlled prefix value */
  prefixValue?: string;
  /** Controlled prefix change */
  onPrefixChange?: (value: string) => void;
  /** Controlled number value */
  value?: string;
  /** Controlled number change */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder for the number input */
  placeholder?: string;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      showPrefix = true,
      showStepper = false,
      prefixOptions = DEFAULT_PREFIX_OPTIONS,
      prefixValue,
      onPrefixChange,
      value,
      onChange,
      placeholder = "Placeholder",
      ...inputProps
    },
    ref
  ) => {
    const [uncontrolledPrefix, setUncontrolledPrefix] = React.useState(
      prefixOptions[0]?.value ?? ""
    );
    const prefix = prefixValue ?? uncontrolledPrefix;

    return (
      <div
        className={cn(
          "flex w-full max-w-[240px] items-stretch overflow-hidden rounded-md border border-input bg-background font-body text-sm",
          className
        )}
        data-name="Phone input"
      >
        {showPrefix && (
          <Select
            value={prefix}
            onValueChange={(v) => {
              onPrefixChange?.(v);
              setUncontrolledPrefix(v);
            }}
          >
            <SelectTrigger
              className={cn(
                "h-10 w-auto min-w-0 shrink-0 gap-2 rounded-none border-0 border-r border-input rounded-l-md py-2.5 pr-2 shadow-none focus:ring-1 focus:ring-ring"
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {prefixOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex flex-1 items-center border-input bg-background">
          <input
            ref={ref}
            type="tel"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={cn(
              "h-10 min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              showPrefix && "rounded-none",
              !showPrefix && "rounded-l-md",
              showStepper ? "pr-2" : "pr-4 rounded-r-md"
            )}
            {...inputProps}
          />
          {showStepper && (
            <div className="flex shrink-0 flex-col rounded-r-md border-l border-input pr-1">
              <button
                type="button"
                tabIndex={-1}
                className="flex h-3 w-4 items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Aumenta"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="flex h-3 w-4 items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Diminuisci"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput, DEFAULT_PREFIX_OPTIONS };
