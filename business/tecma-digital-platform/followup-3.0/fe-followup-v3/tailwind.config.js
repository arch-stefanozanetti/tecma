/** @type {import('tailwindcss').Config} */
import tecmaTheme from "../../design-system/tailwind.theme.ts";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        ...tecmaTheme.fontFamily,
        body: ["var(--body-font)", "Lato", "Segoe UI", "sans-serif"],
        title: ["var(--title-font)", "Lato", "Segoe UI", "sans-serif"],
      },
      fontSize: tecmaTheme.fontSize,
      fontWeight: tecmaTheme.fontWeight,
      lineHeight: tecmaTheme.lineHeight,
      borderRadius: { ...tecmaTheme.borderRadius, lg: "var(--radius)", md: "var(--radius)", sm: "var(--radius)", chrome: "var(--radius)" },
      backgroundImage: {
        "auth-page": "radial-gradient(circle at top left, hsl(230 100% 94% / 1) 0%, var(--app-bg) 45%, hsl(15 80% 97% / 1) 100%)",
        "auth-sidebar": "linear-gradient(to bottom, hsl(230 50% 94%), hsl(238 100% 99%), hsl(15 80% 97%))",
        "sidebar-nav": "linear-gradient(180deg, hsl(230 50% 94%) 7.81%, hsl(15 80% 97%) 95.85%)",
      },
      boxShadow: {
        panel: "0 18px 45px rgba(0, 0, 0, 0.08)",
        "sidebar-nav-active": "0 2px 18px 0 rgba(100,100,100,0.3)",
        "sidebar-nav": "0 2px 9px 0 rgba(100,100,100,0.15)",
        "sidebar": "4px 0 12px 0 rgba(100,100,100,0.15)",
        "dropdown": "0 4px 20px 0 rgba(100,100,100,0.2)",
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
