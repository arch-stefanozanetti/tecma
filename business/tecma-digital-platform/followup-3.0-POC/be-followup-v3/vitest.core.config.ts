/**
 * Coverage "core" BE a 100% (linee/statement/funzioni/branch) sul perimetro strumentato.
 * Lista esplicita = kernel già coperto al 100%; altri moduli core restano testati dalla suite completa
 * senza entrare in questo gate (vedi `test` default / HTTP / integrazione).
 */
import { defineConfig } from "vitest/config";
import path from "path";

const coverageKernel = [
  "src/core/auth/accountLockout.service.ts",
  "src/core/auth/authAudit.service.ts",
  "src/core/auth/inviteToken.service.ts",
  "src/core/auth/passwordPolicy.ts",
  "src/core/auth/passwordResetToken.service.ts",
  "src/core/auth/userPreferences.service.ts",
  "src/core/pricing/price-normalizer.ts",
  "src/core/rbac/enterpriseRoles.mapper.ts",
  "src/core/unit-pricing/unit-pricing.service.ts",
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      EMAIL_TRANSPORT: "mock",
      APP_PUBLIC_URL: "http://localhost:5173",
      MONGO_URI: "mongodb://localhost:27017/followup_test",
      MONGO_DB_NAME: "followup_test",
      SIGNATURE_WEBHOOK_SECRET: "vitest-core-signature-webhook-secret-32!!",
    },
    include: ["src/**/*.test.ts"],
    exclude: ["src/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: coverageKernel,
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
