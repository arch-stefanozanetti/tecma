/**
 * ButtonGroup — DS Tecma Software Suite (Figma).
 * @see https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=456-10239
 *
 * Groups multiple buttons: horizontal = in fila con gap, ogni pulsante con raggio 8px;
 * vertical = stacked con gap.
 * Composes Button; supports Type=Default (Outline + Primary) and Type=Segmented (e.g. secondary + Outline) via child variants.
 */
import * as React from "react";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "./button";

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Horizontal = attached; vertical = stacked with gap, each button rounded */
  orientation?: "horizontal" | "vertical";
  /** Button variant applied to children that don't specify one */
  variant?: ButtonProps["variant"];
  /** Button size applied to all children */
  size?: ButtonProps["size"];
  children: React.ReactNode;
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  (
    {
      className,
      orientation = "horizontal",
      variant = "default",
      size = "default",
      children,
      ...props
    },
    ref
  ) => {
    const isVertical = orientation === "vertical";
    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          isVertical
            ? "flex flex-col gap-2"
            : "inline-flex flex-wrap gap-1 [&>*]:rounded-lg",
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === Button) {
            return React.cloneElement(child as React.ReactElement<ButtonProps>, {
              variant: (child as React.ReactElement<ButtonProps>).props.variant ?? variant,
              size: (child as React.ReactElement<ButtonProps>).props.size ?? size,
            });
          }
          return child;
        })}
      </div>
    );
  }
);
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
