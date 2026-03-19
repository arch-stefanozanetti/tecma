/** @type {import('tailwindcss').Config} */
import { createRequire } from "node:module";
import fallbackTheme from "./tailwind.theme.fallback.js";

const require = createRequire(import.meta.url);

let tecmaTheme = fallbackTheme;
try {
  const importedTheme = require("@tecma/design-system-tokens/tailwind");
  tecmaTheme = importedTheme.default ?? importedTheme;
} catch (error) {
  // In local/dev worktrees the tokens package might not include built dist assets.
  // Keep FE runnable with a safe fallback and preserve CI/E2E stability.
  tecmaTheme = fallbackTheme;
}

/** Tipografia allineata a token Figma via CSS vars */
const std = (key) => [
  `var(--tecma-typography-size-standard-${key})`,
  { lineHeight: `var(--tecma-typography-height-standard-${key})` },
];

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--tecma-typography-typeface-serif)", "Georgia", "serif"],
        sans: ["var(--tecma-typography-typeface-sans-serif)", "Lato", "Segoe UI", "sans-serif"],
        body: ["var(--body-font)", "Lato", "Segoe UI", "sans-serif"],
        title: ["var(--title-font)", "Lato", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        "2xs": std("2xs"),
        xs: std("xs"),
        s: std("s"),
        m: std("m"),
        l: std("l"),
        xl: std("xl"),
        "2xl": std("2xl"),
        "oversize-s": ["var(--tecma-typography-size-oversize-s)", { lineHeight: "1.05" }],
        "oversize-m": ["var(--tecma-typography-size-oversize-m)", { lineHeight: "1.05" }],
        "oversize-l": ["var(--tecma-typography-size-oversize-l)", { lineHeight: "1.05" }],
        "oversize-xl": ["var(--tecma-typography-size-oversize-xl)", { lineHeight: "1.05" }],
      },
      fontWeight: {
        thin: "var(--tecma-typography-weight-thin)",
        light: "var(--tecma-typography-weight-light)",
        regular: "var(--tecma-typography-weight-regular)",
        medium: "var(--tecma-typography-weight-medium)",
        semibold: "var(--tecma-typography-weight-semibold)",
        bold: "var(--tecma-typography-weight-bold)",
      },
      lineHeight: {
        "2xs": "var(--tecma-typography-height-standard-2xs)",
        xs: "var(--tecma-typography-height-standard-xs)",
        s: "var(--tecma-typography-height-standard-s)",
        m: "var(--tecma-typography-height-standard-m)",
        l: "var(--tecma-typography-height-standard-l)",
        xl: "var(--tecma-typography-height-standard-xl)",
        "2xl": "var(--tecma-typography-height-standard-2xl)",
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "8px",
        md: "8px",
        lg: "8px",
        xl: "8px",
        "2xl": "8px",
        "3xl": "8px",
        chrome: "var(--radius-ui)",
      },
      backgroundImage: {
        "auth-page": "radial-gradient(circle at top left, hsl(230 100% 94% / 1) 0%, var(--app-bg) 45%, hsl(15 80% 97% / 1) 100%)",
        "auth-sidebar": "linear-gradient(to bottom, hsl(230 50% 94%), hsl(238 100% 99%), hsl(15 80% 97%))",
        "sidebar-nav": "linear-gradient(180deg, hsl(230 50% 94%) 7.81%, hsl(15 80% 97%) 95.85%)",
      },
      boxShadow: {
        panel: "0 18px 45px rgba(0, 0, 0, 0.08)",
        "sidebar-nav-active": "0 2px 18px 0 rgba(100,100,100,0.3)",
        "sidebar-nav": "0 2px 9px 0 rgba(100,100,100,0.15)",
        sidebar: "4px 0 12px 0 rgba(100,100,100,0.15)",
        dropdown: "0 4px 20px 0 rgba(100,100,100,0.2)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
        app: "var(--app-bg)",
        panel: "var(--panel-bg)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
