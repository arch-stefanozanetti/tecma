import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    setupFiles: ['src/test/setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura', 'html'],
      include: [
        'src/features/auth/**',
        'src/features/users/**',
        'src/features/organization/**',
        'src/features/projects/**',
        'src/core/session/**',
        'src/components/ui/button.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/checkbox.tsx',
        'src/components/support/SupportErrorReport.tsx',
      ],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      thresholds: {
        statements: 60,
        branches: 45,
        functions: 40,
        lines: 60,
        'src/core/session/**': {
          statements: 85,
          branches: 60,
          functions: 90,
          lines: 85,
        },
        'src/features/auth/**': {
          statements: 90,
          branches: 65,
          functions: 80,
          lines: 90,
        },
      },
    },
  },
});
