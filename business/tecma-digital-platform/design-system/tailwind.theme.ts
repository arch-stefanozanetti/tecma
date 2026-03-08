/**
 * Oggetto da usare in tailwind.config.js theme.extend.
 * Import: import tecmaTheme from "@tecma/design-system-tokens/tailwind";
 */
import { typography, radius } from "./tokens/index.js";

function px(n: number): string {
  return `${n}px`;
}

export default {
  fontFamily: {
    serif: [typography.fontFamily.serif],
    sans: [typography.fontFamily.sans],
    body: [typography.fontFamily.body],
    title: [typography.fontFamily.title],
  },
  fontSize: {
    "2xs": px(typography.size.standard["2xs"]),
    xs: px(typography.size.standard.xs),
    s: px(typography.size.standard.s),
    m: px(typography.size.standard.m),
    l: px(typography.size.standard.l),
    xl: px(typography.size.standard.xl),
    "2xl": px(typography.size.standard["2xl"]),
    "oversize-s": px(typography.size.oversize.s),
    "oversize-m": px(typography.size.oversize.m),
    "oversize-l": px(typography.size.oversize.l),
    "oversize-xl": px(typography.size.oversize.xl),
  },
  fontWeight: typography.fontWeight,
  lineHeight: {
    ...Object.fromEntries(
      Object.entries(typography.lineHeight.standard).map(([k, v]) => [k, px(v)])
    ),
    "oversize-s": px(typography.lineHeight.oversize.s),
    "oversize-m": px(typography.lineHeight.oversize.m),
    "oversize-l": px(typography.lineHeight.oversize.l),
  },
  colors: {
    background: "hsl(var(--tecma-background, var(--background)))",
    foreground: "hsl(var(--tecma-foreground, var(--foreground)))",
    primary: {
      DEFAULT: "hsl(var(--tecma-primary, var(--primary)))",
      foreground: "hsl(var(--tecma-primary-foreground, var(--primary-foreground)))",
    },
    // altri semantici se servono; le app possono usare direttamente le variabili CSS
  },
  borderRadius: {
    sm: radius.sm,
    md: radius.md,
    lg: radius.lg,
  },
};
