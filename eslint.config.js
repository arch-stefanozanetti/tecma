import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import securityPlugin from 'eslint-plugin-security';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.generated.ts',
      '**/*.generated.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { project: false },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      security: securityPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
      'no-debugger': 'error',
      eqeqeq: 'off',
      'prefer-const': 'error',
      'no-undef': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-eval-with-expression': 'error',
      'security/detect-unsafe-regex': 'error',
      'import/order': 'off',
    },
  },
  /**
   * Confini tra moduli di dominio: un modulo non deve leggere l'interno di un
   * altro. Il codice condiviso va in `lib/`, `infra/` o nei pacchetti
   * `@followup/*`. Le eccezioni sono infrastruttura trasversale gia' usata come
   * tale (audit, mail): sono elencate qui in modo esplicito, cosi' ogni nuova
   * eccezione passa da una modifica visibile in review.
   */
  {
    files: ['services/api/src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              /**
               * Le pattern seguono la semantica di `.gitignore`: `../x/y` copre
               * anche tutto cio' che sta sotto. Sono elencati esplicitamente i
               * moduli fratelli, cosi' i risalti verso `../../lib`, `../../infra`
               * e `../../schemas` (codice condiviso, consentito) non vengono
               * colpiti per errore.
               */
              group: [
                '../admin/*',
                '../apartments/*',
                '../assets/*',
                '../audit/*',
                '../auth/*',
                '../i18n/*',
                '../mail/*',
                '../projects/*',
                '../rbac/*',
                '../requests/*',
                '../users/*',
                '../workspaces/*',
                '../../modules/*/*',
                /**
                 * `audit/withAudit` e' infrastruttura trasversale (ogni scrittura
                 * di dominio deve produrre un evento di audit): resta consentito.
                 */
                '!../audit/withAudit.js',
              ],
              allowTypeImports: true,
              message:
                'Confine tra moduli: non importare l’interno di un altro modulo. Sposta il codice condiviso in lib/, infra/ o in un pacchetto @followup/*.',
            },
          ],
        },
      ],
    },
  },
  {
    // Eccezioni note e motivate al confine tra moduli.
    files: [
      'services/api/src/modules/**/withAudit.ts',
      'services/api/src/modules/users/routes.ts',
      'services/api/src/modules/admin/emailFlowRoutes.ts',
      'services/api/src/modules/**/*.test.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  prettierConfig,
];
