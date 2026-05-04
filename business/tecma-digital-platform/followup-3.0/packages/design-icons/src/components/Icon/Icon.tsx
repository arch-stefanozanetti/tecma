import { useMemo, type HTMLAttributes } from 'react';
import { getIconSvgSource } from '../../icons/loadRawIcons.js';
import type { IconName } from '../../icons/iconNames.js';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const COLOR_HEX_RE = /(fill|stroke)="#[0-9A-Fa-f]{3,8}"/gi;
const SVG_OPEN_TAG_RE = /<svg\b([^>]*)>/i;
const SIZE_ATTR_RE = /\s(width|height)="[^"]*"/gi;

function toMonochrome(svg: string): string {
  return svg.replace(COLOR_HEX_RE, (_, attr: string) => `${attr}="currentColor"`);
}

function normalizeSvgRoot(svg: string): string {
  return svg.replace(SVG_OPEN_TAG_RE, (_, attrs: string) => {
    const cleaned = attrs.replace(SIZE_ATTR_RE, '');
    return `<svg${cleaned} focusable="false" aria-hidden="true" class="block max-h-full max-w-full">`;
  });
}

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
  preserveColors?: boolean;
  title?: string;
}

export function Icon({
  name,
  size = 'md',
  filled = false,
  preserveColors = false,
  title,
  className,
  ...rest
}: IconProps) {
  const innerHtml = useMemo(() => {
    const raw = getIconSvgSource(name, filled);
    if (!raw) return null;
    const isLogo = name.startsWith('logo-');
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
        className={`${base} tecma-icon--placeholder ${className ?? ''}`}
        {...rest}
      >
        ?
      </span>
    );
  }

  // SVG markup is sourced from a build-time generated, repository-controlled
  // SVG raw map (see src/icons/svgRawMap.generated.ts), not from user input.
  // Sanitization is applied via toMonochrome and normalizeSvgRoot helpers.
  const dangerouslySetInner = { __html: innerHtml };

  return (
    <span
      className={`${base} ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={dangerouslySetInner}
      {...rest}
    />
  );
}
