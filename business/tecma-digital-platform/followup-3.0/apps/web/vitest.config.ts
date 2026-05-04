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
        'src/components/ui/button.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/checkbox.tsx',
      ],
      thresholds: {
        statements: 85,
        branches: 55,
        functions: 85,
        lines: 85,
      },
    },
  },
});
