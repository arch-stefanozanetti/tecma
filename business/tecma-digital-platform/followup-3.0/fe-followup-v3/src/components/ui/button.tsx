/**
 * Button — adapter verso il componente Tecma DS (`@tecma/design-system-tokens/button`).
 * Mantiene l’API legacy (variant default | destructive | outline | …, size default | sm | lg | icon, asChild).
 * Preferire import diretto dal DS per nuove schermate (variant primary | danger | …, loading, icone).
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Button as TecmaButton,
  type ButtonVariant as TecmaVariant,
} from "@tecma/design-system-tokens/button";
import { cn } from "../../lib/utils";

export const buttonVariants = cva("tecma-button", {
  variants: {
    variant: {
      default: "tecma-button--primary",
      destructive: "tecma-button--danger",
      outline: "tecma-button--outline",
      secondary: "tecma-button--secondary",
      muted: "tecma-button--muted",
      ghost: "tecma-button--ghost",
      link: "tecma-button--ghost underline underline-offset-4 hover:underline",
    },
    size: {
      default: "tecma-button--md",
      sm: "tecma-button--sm",
      lg: "tecma-button--lg",
      icon: "tecma-button--md tecma-button--icon-only",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

type LegacyVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

const variantToTecma: Record<LegacyVariant, TecmaVariant> = {
  default: "primary",
  destructive: "danger",
  outline: "outline",
  secondary: "secondary",
  muted: "muted",
  ghost: "ghost",
  link: "ghost",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function mapSize(
  size: VariantProps<typeof buttonVariants>["size"]
): { size: "sm" | "md" | "lg"; iconOnly: boolean } {
  if (size === "icon") return { size: "md", iconOnly: true };
  if (size === "sm") return { size: "sm", iconOnly: false };
  if (size === "lg") return { size: "lg", iconOnly: false };
  return { size: "md", iconOnly: false };
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      type = "button",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const tecmaVariant = variantToTecma[variant ?? "default"];
    const { size: dsSize, iconOnly } = mapSize(size);

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size }), className)}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <TecmaButton
        ref={ref}
        type={type}
        variant={tecmaVariant}
        size={dsSize}
        iconOnly={iconOnly}
        disabled={disabled}
        className={className}
        {...props}
      >
        {children}
      </TecmaButton>
    );
  }
);
Button.displayName = "Button";

export { Button };
