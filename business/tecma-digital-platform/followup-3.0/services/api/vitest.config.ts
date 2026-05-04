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
        'src/plugins/permission.ts',
        'src/plugins/security.ts',
        'src/lib/userIdentity.ts',
        'src/lib/mongoIdentity.ts',
      ],
      exclude: ['scripts/**', 'src/docs/**', 'dist/**', '**/*.test.ts'],
      thresholds: {
        statements: 85,
        branches: 60,
        functions: 85,
        lines: 85,
      },
    },
  },
});
