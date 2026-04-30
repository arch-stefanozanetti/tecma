/**
 * PasswordInput — DS Tecma Software Suite (Figma).
 * Password input with show/hide toggle (eye icon).
 * @see nodes 1411-16338 (Password Input variants)
 */
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { Input, type InputProps } from "./input";

export interface PasswordInputProps extends Omit<InputProps, "type" | "endAdornment"> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, inputSize = "default", ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        inputSize={inputSize}
        className={className}
        endAdornment={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className={cn(
              "shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={visible ? "Nascondi password" : "Mostra password"}
            tabIndex={-1}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        }
        {...props}
      />
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
