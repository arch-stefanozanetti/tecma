import * as React from "react";
import moment from "moment";
import { cn } from "../../lib/utils";
import { DatePickerField } from "./date-picker";
import { Input } from "./input";

export interface DatetimeFieldProps {
  /** Valore `YYYY-MM-DDTHH:mm` (formato datetime-local) */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Min inclusivo (stesso formato), es. inizio evento per campo fine */
  min?: string;
  idPrefix?: string;
}

/**
 * Data (calendario) + ora (step 15 min) — UX migliore rispetto a `datetime-local` nativo.
 */
export function DatetimeField({ value, onChange, disabled, min, idPrefix }: DatetimeFieldProps) {
  const m = value && moment(value, moment.ISO_8601, true).isValid() ? moment(value) : moment();
  const datePart = m.format("YYYY-MM-DD");
  const timePart = m.format("HH:mm");

  const setMerged = (nextDate: string, nextTime: string) => {
    const merged = moment(`${nextDate}T${nextTime}`, "YYYY-MM-DDTHH:mm", true);
    if (!merged.isValid()) return;
    let out = merged.format("YYYY-MM-DDTHH:mm");
    if (min && moment(min, moment.ISO_8601, true).isValid()) {
      const minM = moment(min);
      if (merged.isSameOrBefore(minM)) {
        out = minM.clone().add(1, "minute").format("YYYY-MM-DDTHH:mm");
      }
    }
    onChange(out);
  };

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-stretch")}>
      <div className="min-w-0 flex-1">
        <DatePickerField
          id={idPrefix ? `${idPrefix}-date` : undefined}
          aria-label="Data"
          value={datePart}
          disabled={disabled}
          onChange={(d) => setMerged(d, timePart)}
          min={min ? moment(min).format("YYYY-MM-DD") : undefined}
        />
      </div>
      <Input
        id={idPrefix ? `${idPrefix}-time` : undefined}
        type="time"
        step={300}
        className="sm:w-[7.5rem]"
        inputSize="default"
        disabled={disabled}
        value={timePart}
        min={min && datePart === moment(min).format("YYYY-MM-DD") ? moment(min).format("HH:mm") : undefined}
        onChange={(e) => setMerged(datePart, e.target.value)}
      />
    </div>
  );
}
