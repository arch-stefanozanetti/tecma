/**
 * ButtonGroup — Figma 456:10239 (DS Tecma Software Suite).
 * Bottoni attaccati (0px gap), bordi condivisi, angoli arrotondati solo all’esterno.
 * Type=Default (solid active) / Type=Segmented (outlined). Layout Horizontal | Vertical.
 */
import React, { forwardRef, type ReactNode } from "react";
import { Button } from "../Button";
import type { ButtonSize } from "../Button";
import { cn } from "../../utils/cn";

export type ButtonGroupType = "default" | "segmented";
export type ButtonGroupLayout = "horizontal" | "vertical";

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Layout: orizzontale (fila) o verticale (stack) */
  layout?: ButtonGroupLayout;
  /** Tipo visivo: default (solid) o segmented (outlined) */
  type?: ButtonGroupType;
  /** Size dei bottoni: sm, md, lg (applicato ai figli Button) */
  size?: ButtonSize;
  /** Contenuto: Button come figli */
  children: ReactNode;
  className?: string;
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  (
    {
      layout = "horizontal",
      type = "default",
      size = "md",
      children,
      className,
      ...props
    },
    ref
  ) => {
    const isVertical = layout === "vertical";

    const wrappedChildren = React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === Button) {
        return React.cloneElement(child as React.ReactElement<{ size?: ButtonSize }>, {
          size: (child as React.ReactElement<{ size?: ButtonSize }>).props.size ?? size,
        });
      }
      return child;
    });

    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          "tecma-button-group",
          isVertical ? "tecma-button-group--vertical" : "tecma-button-group--horizontal",
          type === "segmented" && "tecma-button-group--segmented",
          className
        )}
        {...props}
      >
        {wrappedChildren}
      </div>
    );
  }
);
ButtonGroup.displayName = "ButtonGroup";
