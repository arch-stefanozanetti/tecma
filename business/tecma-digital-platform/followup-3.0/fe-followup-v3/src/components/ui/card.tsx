/**
 * Card — contenitore con Header, Content, Footer, Media. Portato da DS, normalizzato (Tailwind).
 */
import * as React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Se true la card si espande in larghezza */
  fluid?: boolean;
  /** Layout interno: verticale (default) o orizzontale */
  orientation?: "vertical" | "horizontal";
  /** Stato selezionato (evidenziazione) */
  selected?: boolean;
  /** Click sulla card (per selezione) */
  onSelect?: React.MouseEventHandler<HTMLDivElement>;
  /** Nasconde il bordo */
  borderLess?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      fluid,
      orientation = "vertical",
      selected,
      onSelect,
      borderLess,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm transition-colors",
        fluid && "w-full",
        orientation === "horizontal" && "flex flex-row",
        orientation === "vertical" && "flex flex-col",
        selected && "ring-2 ring-primary ring-offset-2",
        borderLess && "border-0 shadow-none",
        onSelect && "cursor-pointer",
        className
      )}
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      data-testid="card"
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 pb-0", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

const CardMedia = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("overflow-hidden rounded-t-lg", className)}
    {...props}
  />
));
CardMedia.displayName = "CardMedia";

/** Tabella interna alla card (opzionale) */
const CardTable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-x-auto", className)} {...props} />
));
CardTable.displayName = "CardTable";

/** Wrapper per più card in layout */
const CardContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-wrap gap-4", className)}
    {...props}
  />
));
CardContainer.displayName = "CardContainer";

const CardCompound = Object.assign(Card, {
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
  Media: CardMedia,
  Table: CardTable,
  Container: CardContainer,
});

export {
  CardCompound as Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardMedia,
  CardTable,
  CardContainer,
};
