/**
 * DateInput — campo data DS (Figma 924-7456). Input type="date" con icona calendario.
 * Usabile dentro FormField; riusa Input e useFormField.
 */
import * as React from "react";
import { Calendar } from "lucide-react";
import { Input, type InputProps } from "./input";

export interface DateInputProps
  extends Omit<InputProps, "type"> {}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ endAdornment, ...props }, ref) => (
    <Input
      ref={ref}
      type="date"
      endAdornment={endAdornment ?? <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
      {...props}
    />
  )
);
DateInput.displayName = "DateInput";

export { DateInput };
