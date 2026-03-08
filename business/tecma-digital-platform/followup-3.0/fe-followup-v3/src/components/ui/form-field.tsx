/**
 * FormField — wrapper DS per campi form (Figma 1411-17861, 1411-17860, 1413-14972, 1413-15042, 1413-15070).
 * Riga label (Field Label, * se required, icona info, "(optional)"), control (children), helper text.
 * Stato invalid: helper in rosso; i control esistenti (Input, Checkbox, ecc.) gestiscono il proprio bordo/icona.
 * Per a11y, passa lo stesso id a FormField e al control, oppure usa useFormField() dentro il control.
 */
import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { Tooltip } from "./tooltip";

export interface FormFieldContextValue {
  id: string;
  helperId: string | undefined;
  invalid: boolean | undefined;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

/** Hook per usare id / helperId / invalid del FormField nel control (es. Input, SelectTrigger). */
export function useFormField(): FormFieldContextValue | null {
  return React.useContext(FormFieldContext);
}

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Testo label sopra il control */
  label: React.ReactNode;
  /** Campo obbligatorio (mostra asterisco) */
  required?: boolean;
  /** Mostra "(optional)" accanto alla label quando non required */
  optional?: boolean;
  /** Testo helper sotto il control; in stato invalid viene mostrato in rosso */
  helperText?: React.ReactNode;
  /** Stato errore: helper in rosso */
  invalid?: boolean;
  /** Id del control (per htmlFor / aria-describedby); se non passato viene generato */
  id?: string;
  /** Testo per tooltip icona info (se assente, l'icona non viene mostrata) */
  infoTooltip?: React.ReactNode;
  /** Contenuto: Input, Select, Checkbox, RadioGroup, Slider, ecc. */
  children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      label,
      required,
      optional = false,
      helperText,
      invalid,
      id: idProp,
      infoTooltip,
      children,
      ...props
    },
    ref
  ) => {
    const id = idProp ?? React.useId();
    const helperId = helperText != null ? `${id}-helper` : undefined;

    return (
      <FormFieldContext.Provider
        value={{ id, helperId: helperId ?? undefined, invalid }}
      >
        <div
          ref={ref}
          className={cn("flex flex-col gap-1.5", className)}
          data-invalid={invalid ?? undefined}
          {...props}
        >
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={id}
              className="text-sm font-medium leading-tight text-foreground"
            >
              {label}
              {required && (
                <span className="ml-0.5 text-destructive" aria-hidden>
                  *
                </span>
              )}
            </label>
            {!required && optional && (
              <span className="text-xs font-medium leading-tight text-muted-foreground">
                (optional)
              </span>
            )}
            {infoTooltip != null && (
              <Tooltip content={infoTooltip} side="top">
                <span className="inline-flex text-muted-foreground focus-within:ring-2 focus-within:ring-ring rounded">
                  <Info className="h-4 w-4" aria-hidden />
                </span>
              </Tooltip>
            )}
          </div>
          {children}
          {helperText != null && (
            <p
              id={helperId}
              role={invalid ? "alert" : undefined}
              className={cn(
                "text-xs font-medium leading-tight",
                invalid ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {helperText}
            </p>
          )}
        </div>
      </FormFieldContext.Provider>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
