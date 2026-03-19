import { useMemo, type HTMLAttributes } from "react";
import { getIconSvgSource } from "../../icons/loadRawIcons";
import type { IconName } from "../../icons/iconNames";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

function toMonochrome(svg: string): string {
  return svg
    .replace(/fill="#[0-9A-Fa-f]{3,8}"/gi, 'fill="currentColor"')
    .replace(/stroke="#[0-9A-Fa-f]{3,8}"/gi, 'stroke="currentColor"');
}

function normalizeSvgRoot(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    const cleaned = attrs
      .replace(/\swidth="[^"]*"/gi, "")
      .replace(/\sheight="[^"]*"/gi, "");
    return `<svg${cleaned} focusable="false" aria-hidden="true" class="block max-h-full max-w-full">`;
  });
}

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
  preserveColors?: boolean;
  title?: string;
}

export function Icon({
  name,
  size = "md",
  filled = false,
  preserveColors = false,
  title,
  className,
  ...rest
}: IconProps) {
  const innerHtml = useMemo(() => {
    const raw = getIconSvgSource(name, filled);
    if (!raw) return null;
    const isLogo = name.startsWith("logo-");
    const mono = !preserveColors && !isLogo;
    let svg = normalizeSvgRoot(raw);
    if (mono) svg = toMonochrome(svg);
    return svg;
  }, [name, filled, preserveColors]);

  const sizeClass = `tecma-icon--${size}`;
  const base = `tecma-icon ${sizeClass}`;

  if (!innerHtml) {
    return (
      <span
        role="img"
        title={title ?? `Icon mancante: ${name}`}
        className={`${base} tecma-icon--placeholder ${className ?? ""}`}
        {...rest}
      >
        ?
      </span>
    );
  }

  return (
    <span
      className={`${base} ${className ?? ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: innerHtml }}
      {...rest}
    />
  );
}
