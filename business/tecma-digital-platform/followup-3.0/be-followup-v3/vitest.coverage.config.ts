import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Config unica per report coverage: include unit, api e integration.
 * Esegui: npm run test:coverage
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/index.ts",
        "src/types/express.d.ts",
        "dist",
        "src/utils/seed.ts",
        "src/utils/listCollections.ts",
        "src/utils/copyCollections.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
