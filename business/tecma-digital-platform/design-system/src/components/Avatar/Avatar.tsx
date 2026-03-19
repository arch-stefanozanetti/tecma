import { Icon } from "../Icon";
import { cn } from "../../utils/cn";

export type AvatarSize = "sm" | "md" | "lg";
export type AvatarVariant = "icon" | "image" | "text";

export interface AvatarProps {
  /** Tipo: icon (user), image (foto), text (iniziali) */
  variant?: AvatarVariant;
  /** Dimensione: 24px (sm), 40px (md), 64px (lg) — Figma 725:6764 */
  size?: AvatarSize;
  /** Testo per variant "text" (es. iniziali "MR") */
  contentText?: string;
  /** URL immagine per variant "image"; alt per accessibilità */
  src?: string;
  alt?: string;
  className?: string;
  /** Accessibilità: label per icon/text (es. "Avatar di Mario Rossi") */
  "aria-label"?: string;
}

/**
 * Avatar — Figma 725:6764. Cerchio con icon (user), image o iniziali (text).
 * Valori da Figma: 24/40/64px, padding 4/8/16px, icon 16/24/32px, border 1px per icon/text.
 */
export function Avatar({
  variant = "icon",
  size = "lg",
  contentText = "MR",
  src,
  alt = "",
  className,
  "aria-label": ariaLabel,
}: AvatarProps) {
  const sizeClass = `tecma-avatar--${size}`;
  const variantClass = `tecma-avatar--${variant}`;
  const rootClass = cn("tecma-avatar", sizeClass, variantClass, className);

  const label = ariaLabel ?? (variant === "text" ? contentText : variant === "image" ? alt : "Avatar utente");

  if (variant === "icon") {
    const iconSize = size === "sm" ? "sm" : size === "md" ? "lg" : "xl";
    return (
      <div
        className={rootClass}
        role="img"
        aria-label={label}
      >
        <span className="tecma-avatar__icon-slot">
          <Icon name="user" size={iconSize} aria-hidden />
        </span>
      </div>
    );
  }

  if (variant === "image") {
    return (
      <div className={rootClass} role="img" aria-label={label}>
        {src ? (
          <img
            src={src}
            alt={alt}
            className="tecma-avatar__img"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="tecma-avatar__text" aria-hidden>
            —
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={rootClass} role="img" aria-label={label}>
      <span className="tecma-avatar__text" aria-hidden>
        {contentText ? contentText.slice(0, 2).toUpperCase() : "—"}
      </span>
    </div>
  );
}
