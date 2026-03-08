/**
 * ProgressIndicator — N step con barre di progresso; compone Progress. Portato da DS, normalizzato.
 */
import * as React from "react";
import { cn } from "../../lib/utils";
import { Progress } from "./progress";

export interface ProgressIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Numero totale di step */
  steps: number;
  /** Step corrente (1-based) */
  currentStep: number;
  /** Valore percentuale (0–100) per la barra dello step corrente */
  valueProgressBar: number;
  /** Mostra label "currentStep / steps" */
  showValue?: boolean;
}

const ProgressIndicator = React.forwardRef<
  HTMLDivElement,
  ProgressIndicatorProps
>(
  (
    {
      className,
      steps,
      currentStep,
      valueProgressBar,
      showValue = false,
      ...props
    },
    ref
  ) => {
    const getStepValue = (step: number) => {
      if (step === currentStep) return valueProgressBar;
      if (step < currentStep) return 100;
      return 0;
    };

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        data-testid="progress-indicator"
        {...props}
      >
        {showValue && (
          <p className="text-sm font-medium text-foreground">
            {currentStep} / {steps}
          </p>
        )}
        <div className="flex gap-1">
          {Array.from({ length: steps }, (_, i) => {
            const step = i + 1;
            const value = getStepValue(step);
            const isCurrent = step === currentStep;
            return (
              <div
                key={step}
                className={cn(
                  "min-w-0 flex-1",
                  isCurrent && "flex-[1.5]"
                )}
              >
                <Progress value={value} showLabel={false} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ProgressIndicator.displayName = "ProgressIndicator";

export { ProgressIndicator };
