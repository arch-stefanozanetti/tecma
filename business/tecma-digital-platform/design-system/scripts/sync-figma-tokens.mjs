/**
 * Sincronizza solo token presenti in Figma:
 * - Alias / Tecma v2 → --tecma-color-* (colori)
 * - Typography / Tecma → --tecma-typography-* (typeface, weight, size, height)
 *
 * Output: tokens/typography.ts, tokens/color.ts, tokens/radius.ts, css/tokens.css
 * Radius: Alias.values.border-radius (Tecma v2) + data/figma-primitives-radius.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function hexToRgb(hex) {
  const h = hex.replace(/^#/, "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  };
}

function hexToHslTriplet(hex) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  const H = Math.round(h * 360);
  const S = Math.round(s * 1000) / 10;
  const L = Math.round(l * 1000) / 10;
  return `${H} ${S}% ${L}%`;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
}

const variables = loadJson("data/figma-variables.json");
const primitivesRaw = loadJson("data/figma-primitives-hex.json");
const primitives = Object.fromEntries(
  Object.entries(primitivesRaw).filter(([k]) => !k.startsWith("$") && !k.startsWith("_"))
);

const radiusPrimitivesRaw = loadJson("data/figma-primitives-radius.json");
const radiusPrimitives = Object.fromEntries(
  Object.entries(radiusPrimitivesRaw).filter(([k]) => !k.startsWith("$") && !k.startsWith("_"))
);

function resolveColor(val, stack = new Set()) {
  if (typeof val !== "string") return null;
  if (val.startsWith("#")) return val;
  if (!val.startsWith("{")) return null;
  const key = val.slice(1, -1);
  if (stack.has(key)) throw new Error(`Circular ref: ${key}`);
  stack.add(key);
  const next = primitives[key];
  if (!next) throw new Error(`Primitive mancante: "${key}"`);
  const out = resolveColor(next, stack);
  stack.delete(key);
  return out;
}

function resolveRadiusVal(val, stack = new Set()) {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val !== "string") throw new Error(`Radius: valore non valido ${val}`);
  if (val.startsWith("{")) {
    const key = val.slice(1, -1);
    if (stack.has(key)) throw new Error(`Circular radius: ${key}`);
    stack.add(key);
    const next = radiusPrimitives[key];
    if (next === undefined) throw new Error(`Primitive radius mancante: "${key}" in figma-primitives-radius.json`);
    const out = resolveRadiusVal(
      typeof next === "number" ? next : typeof next === "string" && next.startsWith("{") ? next : Number(next),
      stack
    );
    stack.delete(key);
    return out;
  }
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error(`Radius: ${val}`);
  return n;
}

const aliasMode = variables[0].Alias.modes["Tecma v2"];
const typoMode = variables[1].Typography.modes.Tecma;

function walkColors(obj, prefix, out) {
  if (!obj || typeof obj !== "object") return;
  if (obj.$type === "color" && typeof obj.$value === "string") {
    out[prefix] = resolveColor(obj.$value);
    return;
  }
  for (const k of Object.keys(obj)) {
    if (k.startsWith("$")) continue;
    walkColors(obj[k], prefix ? `${prefix}/${k}` : k, out);
  }
}

const semanticHex = {};
walkColors(aliasMode.colors, "", semanticHex);

/** values.border-radius → px (Figma float) */
const borderRadiusSemantic = {};
const brRoot = aliasMode.values?.["border-radius"];
if (brRoot && typeof brRoot === "object") {
  for (const k of Object.keys(brRoot)) {
    if (k.startsWith("$")) continue;
    const node = brRoot[k];
    if (node && node.$type === "float" && node.$value !== undefined) {
      borderRadiusSemantic[k] = resolveRadiusVal(node.$value);
    }
  }
}

function pathToCssVar(p) {
  return `--tecma-color-${p.replace(/\//g, "-")}`;
}

function pathToTsKey(p) {
  return p.replace(/\//g, ".");
}

const weightMap = {
  thin: 100,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const tw = typoMode.weight;
const sz = typoMode.values.size;
const lh = typoMode.values.height;
/** Figma Tecma a volte non espone height.standard.2xl: fallback ~1.42× font size */
const standard2xlLh =
  lh.standard?.["2xl"]?.$value != null
    ? lh.standard["2xl"].$value
    : Math.round(sz.standard["2xl"].$value * 1.42);
const hasStandard2xlInFigma =
  lh.standard?.["2xl"] != null && lh.standard["2xl"].$value != null;

const typographyTs = `/**
 * Generato da scripts/sync-figma-tokens.mjs — Typography / mode Tecma (Figma)
 */

export const typography = {
  fontFamily: {
    serif: '"${typoMode.typeface.serif.$value}", Georgia, serif',
    sans: '"${typoMode.typeface["sans serif"].$value}", "Segoe UI", sans-serif',
    body: '"${typoMode.typeface["sans serif"].$value}", "Segoe UI", sans-serif',
    title: '"${typoMode.typeface["sans serif"].$value}", "Segoe UI", sans-serif',
  },

  fontWeight: {
    thin: ${weightMap[tw.thin.$value] ?? 100},
    light: ${weightMap[tw.light.$value] ?? 300},
    regular: ${weightMap[tw.regular.$value] ?? 400},
    medium: ${weightMap[tw.medium.$value] ?? 500},
    semibold: ${weightMap[tw.semibold.$value] ?? 600},
    bold: ${weightMap[tw.bold.$value] ?? 700},
  },

  size: {
    standard: {
      "2xs": ${sz.standard["2xs"].$value},
      xs: ${sz.standard.xs.$value},
      s: ${sz.standard.s.$value},
      m: ${sz.standard.m.$value},
      l: ${sz.standard.l.$value},
      xl: ${sz.standard.xl.$value},
      "2xl": ${sz.standard["2xl"].$value},
    },
    oversize: {
      s: ${sz.oversize.s.$value},
      m: ${sz.oversize.m.$value},
      l: ${sz.oversize.l.$value},
      xl: ${sz.oversize.xl.$value},
    },
  },

  lineHeight: {
    standard: {
      "2xs": ${lh.standard["2xs"].$value},
      xs: ${lh.standard.xs.$value},
      s: ${lh.standard.s.$value},
      m: ${lh.standard.m.$value},
      l: ${lh.standard.l.$value},
      xl: ${lh.standard.xl.$value},
      "2xl": ${standard2xlLh},
    },
    oversize: {
      s: ${lh.oversize.s.$value},
      m: ${lh.oversize.m.$value},
      l: ${lh.oversize.l.$value},
      xl: ${lh.oversize.xl.$value},
    },
  },
} as const;

export type TypographyToken = typeof typography;
`;

const semanticTsEntries = Object.entries(semanticHex)
  .map(([p, hex]) => `    "${pathToTsKey(p)}": "${hexToHslTriplet(hex)}",`)
  .sort()
  .join("\n");

const colorTs = `/**
 * Generato da scripts/sync-figma-tokens.mjs — Alias / Tecma v2 (Figma)
 */

export const color = {
  hsl: {
${semanticTsEntries}
  },
  hex: {
${Object.entries(semanticHex)
  .map(([p, h]) => `    "${pathToTsKey(p)}": "${h}",`)
  .sort()
  .join("\n")}
  },
} as const;

export type ColorToken = typeof color;
`;

const semanticCss = Object.entries(semanticHex)
  .map(([p, hex]) => `  ${pathToCssVar(p)}: ${hexToHslTriplet(hex)};`)
  .sort()
  .join("\n");

const serif = `"${typoMode.typeface.serif.$value}"`;
const sans = `"${typoMode.typeface["sans serif"].$value}"`;

const typoCss = [
  `  --tecma-typography-typeface-serif: ${serif};`,
  `  --tecma-typography-typeface-sans-serif: ${sans};`,
  ...Object.entries(tw).map(
    ([k, v]) =>
      `  --tecma-typography-weight-${k}: ${weightMap[v.$value] ?? v.$value};`
  ),
  ...Object.entries(sz.standard).map(
    ([k, v]) => `  --tecma-typography-size-standard-${k}: ${v.$value}px;`
  ),
  ...Object.entries(sz.oversize).map(
    ([k, v]) => `  --tecma-typography-size-oversize-${k}: ${v.$value}px;`
  ),
  ...Object.entries(lh.standard).map(
    ([k, v]) => `  --tecma-typography-height-standard-${k}: ${v.$value}px;`
  ),
  ...(hasStandard2xlInFigma
    ? []
    : [`  --tecma-typography-height-standard-2xl: ${standard2xlLh}px;`]),
  ...Object.entries(lh.oversize).map(
    ([k, v]) => `  --tecma-typography-height-oversize-${k}: ${v.$value}px;`
  ),
].join("\n");

const radiusCss = Object.entries(borderRadiusSemantic)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, px]) => `  --tecma-values-border-radius-${k}: ${px}px;`)
  .join("\n");

const ext = borderRadiusSemantic.external ?? 8;
const int = borderRadiusSemantic.internal ?? 2;
const el = borderRadiusSemantic.element ?? 2;
const std = borderRadiusSemantic.standard ?? int;

const radiusTs = `/**
 * Generato da sync-figma-tokens.mjs
 * border-radius: Alias Global → values.border-radius (mode Tecma v2)
 * Primitive: data/figma-primitives-radius.json (es. radius.square.*)
 */

/** Nomi Figma: external (card), internal (in card), element (es. button), standard */
export const borderRadius = {
  external: "var(--tecma-values-border-radius-external)",
  internal: "var(--tecma-values-border-radius-internal)",
  element: "var(--tecma-values-border-radius-element)",
  standard: "var(--tecma-values-border-radius-standard)",
} as const;

export const borderRadiusPx = {
  external: ${ext},
  internal: ${int},
  element: ${el},
  standard: ${std},
} as const;

/** Convenzione scala (sm/md/lg) se serve in app */
export const radius = {
  sm: borderRadius.standard,
  md: borderRadius.element,
  lg: borderRadius.external,
  DEFAULT: borderRadius.element,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type BorderRadiusToken = typeof borderRadius;
export type RadiusToken = typeof radius;
export type SpacingToken = typeof spacing;
`;

const tokensCss = `/**
 * Variabili Figma (Alias Tecma v2 + Typography Tecma).
 * Rigenera: npm run sync:tokens
 */

:root {
  /* Typography / Tecma */
${typoCss}

  /* values.border-radius / Tecma v2 → --tecma-values-border-radius-* */
${radiusCss}

  /* Alias / Tecma v2 (colori) */
${semanticCss.split("\n").map((l) => "  " + l.trim()).join("\n")}
}
`;

fs.writeFileSync(path.join(root, "tokens/typography.ts"), typographyTs);
fs.writeFileSync(path.join(root, "tokens/color.ts"), colorTs);
fs.writeFileSync(path.join(root, "tokens/radius.ts"), radiusTs);
fs.writeFileSync(path.join(root, "css/tokens.css"), tokensCss);

console.log("OK: typography, color, radius, css/tokens.css");
console.log(
  `   ${Object.keys(semanticHex).length} colori; border-radius: ${Object.keys(borderRadiusSemantic).join(", ")}`
);
