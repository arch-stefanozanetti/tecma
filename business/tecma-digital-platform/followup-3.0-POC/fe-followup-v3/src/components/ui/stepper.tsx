/**
 * Stepper — passi numerati con stato completato/attivo/da fare. Portato da DS, normalizzato (Tailwind).
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface StepperStep {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Step corrente (0-based) */
  currentStep: number;
  /** Definizione step (label opzionale per ogni step) */
  steps: StepperStep[] | number;
  /** Orientamento */
  orientation?: "horizontal" | "vertical";
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ className, currentStep, steps, orientation = "horizontal", ...props }, ref) => {
    const stepList: StepperStep[] =
      typeof steps === "number"
        ? Array.from({ length: steps }, () => ({}))
        : steps;
    const count = stepList.length;

    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" && "flex-row items-start",
          orientation === "vertical" && "flex-col",
          className
        )}
        data-testid="stepper"
        {...props}
      >
        {stepList.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === count - 1;

          return (
            <React.Fragment key={index}>
              <div
                className={cn(
                  "flex items-center gap-2",
                  orientation === "vertical" && "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-background text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex flex-col py-0.5">
                  {step.label != null && (
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  )}
                  {step.description != null && (
                    <span className="text-xs text-muted-foreground">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "shrink-0 bg-border",
                    orientation === "horizontal" && "mx-2 mt-4 h-0.5 w-8",
                    orientation === "vertical" && "my-2 ml-4 h-8 w-0.5"
                  )}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);
Stepper.displayName = "Stepper";

export { Stepper };
