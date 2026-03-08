import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5177,
    proxy: {
      "/v1": {
        target: "http://localhost:5060",
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
      // Tutta l’app in report: obiettivo 100% ovunque (vedi docs/PLAN_100_PERCENT_FULL_APP.md)
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
