import * as React from "react";
import { format, isValid, parseISO, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerFieldProps {
  /** Valore `YYYY-MM-DD` o stringa vuota */
  value: string;
  onChange: (value: string) => void;
  /** Etichetta accessibile sul trigger */
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Min/max come `YYYY-MM-DD` */
  min?: string;
  max?: string;
  className?: string;
  /** Compatta (toolbar filtri) */
  size?: "default" | "sm";
}

function parseYmd(value: string): Date | undefined {
  if (!value?.trim()) return undefined;
  try {
    const d = parseISO(value);
    return isValid(d) ? startOfDay(d) : undefined;
  } catch {
    return undefined;
  }
}

function inRange(d: Date, min?: string, max?: string): boolean {
  const t = d.getTime();
  if (min) {
    const lo = parseYmd(min);
    if (lo && t < lo.getTime()) return false;
  }
  if (max) {
    const hi = parseYmd(max);
    if (hi && t > hi.getTime()) return false;
  }
  return true;
}

/**
 * Selettore data con calendario a comparsa (sostituisce `input type="date"`).
 */
export const DatePickerField = React.forwardRef<HTMLButtonElement, DatePickerFieldProps>(function DatePickerField(
  {
    value,
    onChange,
    "aria-label": ariaLabel,
    id,
    disabled,
    invalid,
    placeholder = "Seleziona data",
    min,
    max,
    className,
    size = "default",
  },
  ref
) {
  const [open, setOpen] = React.useState(false);
  const selected = parseYmd(value);
  const label =
    selected != null
      ? format(selected, "d MMMM yyyy", { locale: it })
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "w-full justify-start gap-2 text-left font-normal",
            !value && "text-muted-foreground",
            size === "sm" && "h-8 px-3 text-xs",
            invalid && "border-destructive ring-1 ring-destructive",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          key={value || "empty"}
          mode="single"
          defaultMonth={selected ?? new Date()}
          selected={selected}
          onSelect={(d) => {
            if (!d) {
              onChange("");
              return;
            }
            onChange(format(startOfDay(d), "yyyy-MM-dd"));
            setOpen(false);
          }}
          disabled={(date) => !inRange(date, min, max)}
        />
      </PopoverContent>
    </Popover>
  );
});

DatePickerField.displayName = "DatePickerField";
