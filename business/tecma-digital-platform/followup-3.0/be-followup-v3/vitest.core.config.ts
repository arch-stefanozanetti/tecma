import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      EMAIL_TRANSPORT: "mock",
      APP_PUBLIC_URL: "http://localhost:5173",
    },
    include: ["src/**/*.test.ts"],
    exclude: ["src/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/core/auth/**/*.ts",
        "src/core/clients/**/*.ts",
        "src/core/apartments/**/*.ts",
        "src/core/requests/**/*.ts",
        "src/core/workflow/**/*.ts",
        "src/core/calendar/**/*.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 10,
        branches: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
