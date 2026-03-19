import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      EMAIL_TRANSPORT: "mock",
      APP_PUBLIC_URL: "http://localhost:5173",
      MONGO_URI: "mongodb://localhost:27017/followup_test",
      MONGO_DB_NAME: "followup_test",
    },
    include: ["src/**/*.test.ts"],
    exclude: ["src/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/core/auth/**/*.ts",
        "src/core/rbac/**/*.ts",
        "src/core/clients/**/*.ts",
        "src/core/apartments/**/*.ts",
        "src/core/requests/**/*.ts",
        "src/core/workflow/**/*.ts",
        "src/core/calendar/**/*.ts",
        "src/core/sale-prices/**/*.ts",
        "src/core/monthly-rents/**/*.ts",
        "src/core/inventory/**/*.ts",
        "src/core/rate-plans/**/*.ts",
        "src/core/unit-pricing/**/*.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 95,
        branches: 53,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
