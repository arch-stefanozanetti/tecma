/**
 * Coverage "core" FE a 100% sul kernel strumentato (lib + scope auth).
 * Pagine e API client restano coperte dalla suite completa senza questo gate.
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const coverageKernel = [
  "src/lib/spaPath.ts",
  "src/lib/ds-form-classes.ts",
  "src/auth/projectScope.ts",
];

/** Solo test che coprono il kernel (evita suite intera: minuti vs secondi). */
const coreTestFiles = [
  "src/lib/spaPath.test.ts",
  "src/lib/spaPath.node-env.test.ts",
  "src/lib/ds-form-classes.test.ts",
  "src/auth/projectScope.test.ts",
  "src/auth/projectScope.node-env.test.ts",
];

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
    include: coreTestFiles,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: coverageKernel,
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
});
