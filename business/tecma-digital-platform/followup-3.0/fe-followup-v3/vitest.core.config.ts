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
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/api/**/*.ts",
        "src/auth/**/*.ts",
        "src/core/clients/**/*.tsx",
        "src/core/apartments/**/*.tsx",
        "src/core/requests/**/*.tsx",
      ],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      thresholds: {
        lines: 45,
        statements: 45,
        functions: 25,
        branches: 25,
      },
    },
  },
});
