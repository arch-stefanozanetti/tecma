/**
 * ButtonGroup — usa il componente DS (Figma 456:10239).
 * Bottoni attaccati (0px gap), bordi condivisi, angoli arrotondati solo all’esterno.
 */
import * as React from "react";
import {
  ButtonGroup as DSButtonGroup,
  type ButtonGroupLayout,
  type ButtonGroupType,
} from "@/tecma-ds/button-group";
import { Button, type ButtonProps } from "./button";
import { cn } from "../../lib/utils";

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** horizontal = in fila attaccati; vertical = stack attaccati */
  orientation?: "horizontal" | "vertical";
  /** Tipo: default (solid) o segmented (outlined) */
  type?: "default" | "segmented";
  /** Size dei bottoni (default = md) */
  size?: ButtonProps["size"];
  /** Variante applicata ai figli che non la specificano */
  variant?: ButtonProps["variant"];
  children: React.ReactNode;
}

const orientationToLayout: Record<"horizontal" | "vertical", ButtonGroupLayout> = {
  horizontal: "horizontal",
  vertical: "vertical",
};

const sizeToDS: Record<string, "sm" | "md" | "lg"> = {
  default: "md",
  sm: "sm",
  md: "md",
  lg: "lg",
  icon: "md",
};

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  (
    {
      className,
      orientation = "horizontal",
      type = "default",
      size = "default",
      variant = "default",
      children,
      ...props
    },
    ref
  ) => {
    const dsSize = sizeToDS[size ?? "default"] ?? "md";

    return (
      <DSButtonGroup
        ref={ref}
        layout={orientationToLayout[orientation]}
        type={type as ButtonGroupType}
        size={dsSize}
        className={cn(className)}
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
      </DSButtonGroup>
    );
  }
);
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
