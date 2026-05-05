import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura', 'html'],
      include: [
        'src/modules/auth/**',
        'src/modules/projects/**',
        'src/modules/workspaces/**',
        'src/modules/users/**',
        'src/modules/rbac/**',
        'src/modules/audit/**',
        'src/plugins/permission.ts',
        'src/plugins/security.ts',
        'src/plugins/apiKey.ts',
        'src/lib/userIdentity.ts',
        'src/lib/mongoIdentity.ts',
        'src/lib/apiError.ts',
        'src/lib/projectAccess.ts',
      ],
      exclude: ['scripts/**', 'src/docs/**', 'dist/**', '**/*.test.ts'],
      thresholds: {
        statements: 85,
        branches: 60,
        functions: 85,
        lines: 85,
        'src/modules/rbac/**': {
          statements: 95,
          branches: 80,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
