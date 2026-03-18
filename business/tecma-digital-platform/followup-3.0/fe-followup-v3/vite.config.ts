import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const appVersion =
  typeof process.env.VITE_APP_VERSION === "string" && process.env.VITE_APP_VERSION
    ? process.env.VITE_APP_VERSION
    : (pkg?.version ?? "0.0.0");
const proxyTarget =
  typeof process.env.VITE_PROXY_TARGET === "string" && process.env.VITE_PROXY_TARGET
    ? process.env.VITE_PROXY_TARGET
    : "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5177,
    proxy: {
      "/v1": {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Tutta l’app in report: obiettivo 100% ovunque (vedi docs/archive/PLAN_100_PERCENT_FULL_APP.md)
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test-utils.tsx",
        "**/node_modules/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "**/index.ts",
        "**/*.d.ts",
        "src/types/**",
        "src/data/mockData.ts",
      ],
    },
  },
});
