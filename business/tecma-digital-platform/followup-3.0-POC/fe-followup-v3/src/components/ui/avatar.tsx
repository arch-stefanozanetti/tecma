/**
 * Avatar — rappresentazione utente: immagine, iniziali (text) o icona. Portato da DS, normalizzato (Tailwind + Radix).
 */
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../../lib/utils";

export type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: AvatarSize;
  /** URL immagine */
  src?: string | null;
  /** Testo alternativo per img; usato anche per iniziali se non c'è src */
  alt?: string;
  /** Iniziali o testo da mostrare se non c'è src (es. "MR" per Mario Rossi) */
  text?: string;
  /** Icona da mostrare se non c'è src né text (ReactNode, es. lucide-react) */
  icon?: React.ReactNode;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size = "md", src, alt = "", text, icon, ...props }, ref) => {
  const sizeClass = sizeClasses[size];

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-muted font-medium text-muted-foreground",
        sizeClass,
        className
      )}
      data-testid="avatar"
      {...props}
    >
      {src != null && src !== "" ? (
        <AvatarPrimitive.Image
          src={src}
          alt={alt}
          className="aspect-square h-full w-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center"
        delayMs={src ? 100 : 0}
      >
        {text != null && text !== "" ? (
          <span className="truncate px-0.5">{text}</span>
        ) : icon ? (
          <span className="[&_svg]:h-[60%] [&_svg]:w-[60%]">{icon}</span>
        ) : (
          <span aria-hidden>?</span>
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});
Avatar.displayName = AvatarPrimitive.Root.displayName;

export { Avatar };
