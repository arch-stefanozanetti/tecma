/**
 * Toggle (Switch) — DS Tecma Software Suite (Figma).
 * Sizes: Small (16px), Medium (24px), Large (32px). States: Default, Focus, Disabled, Muted.
 */
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";

const toggleSizes = {
  sm: "h-4 w-8",
  md: "h-6 w-12",
  lg: "h-8 w-16",
} as const;

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  /** Size from DS: Small (16px), Medium (24px), Large (32px) */
  size?: keyof typeof toggleSizes;
  /** Muted variant: lighter track when unchecked */
  muted?: boolean;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size = "sm", muted, ...props }, ref) => {
  const sizeClass = toggleSizes[size];
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-muted-foreground/30 data-[state=checked]:bg-primary",
        muted && "data-[state=unchecked]:bg-muted data-[state=checked]:bg-primary/10",
        sizeClass,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform",
          "translate-x-0.5",
          size === "sm" && "h-3 w-3 data-[state=checked]:translate-x-4",
          size === "md" && "h-5 w-5 data-[state=checked]:translate-x-6",
          size === "lg" && "h-7 w-7 data-[state=checked]:translate-x-8",
        )}
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
