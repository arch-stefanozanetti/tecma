/**
 * Textarea — DS Tecma Software Suite (Figma).
 * States: Default, Focus, Filled, Disabled, Read-only, Invalid.
 * Optional footer: helper text, character count.
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state: red border */
  invalid?: boolean;
  /** Helper text below the textarea */
  helperText?: React.ReactNode;
  /** Max length for character count; show count when set */
  maxLength?: number;
  /** Show "current/maxLength" in footer when maxLength is set */
  showWordCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      invalid,
      helperText,
      maxLength,
      showWordCount = true,
      disabled,
      readOnly,
      value,
      ...props
    },
    ref
  ) => {
    const showFooter = Boolean(helperText || (maxLength != null && showWordCount));
    const currentLength =
      typeof value === "string"
        ? value.length
        : (props.defaultValue as string)?.length ?? 0;

    return (
      <div className={cn("flex w-full flex-col gap-2", className)}>
        <textarea
          ref={ref}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          className={cn(
            "min-h-[116px] w-full resize-y rounded-md border bg-background px-4 py-2 text-sm font-body leading-5 text-foreground placeholder:text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
            "read-only:cursor-default read-only:bg-muted",
            invalid
              ? "border-destructive focus-visible:ring-destructive"
              : "border-input shadow-sm"
          )}
          {...props}
        />
        {showFooter && (
          <div className="flex items-center justify-end gap-2 text-xs font-medium text-muted-foreground">
            {helperText && (
              <span className="flex-1 text-left leading-tight">
                {helperText}
              </span>
            )}
            {maxLength != null && showWordCount && (
              <span className="shrink-0 tabular-nums">
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
