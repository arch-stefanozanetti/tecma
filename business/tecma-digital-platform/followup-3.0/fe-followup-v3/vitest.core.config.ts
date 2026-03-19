import { defineConfig } from "vitest/config";
import { baseVitePlugins } from "./vite.base-plugins";

export default defineConfig({
  plugins: [...baseVitePlugins()],
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
        "src/core/projects/**/*.tsx",
        "src/core/calendar/**/*.tsx",
        "src/core/releases/**/*.tsx",
        "src/core/customer-portal/**/*.tsx",
        "src/core/workflows/**/*.tsx",
        "src/core/settings/**/*.tsx",
        "src/core/prices/**/*.tsx",
        "src/core/integrations/**/*.tsx",
        "src/core/product-discovery/**/*.tsx",
        "src/core/customer360/**/*.tsx",
      ],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      thresholds: {
        lines: 46,
        statements: 46,
        functions: 24,
        branches: 55,
      },
    },
  },
});
