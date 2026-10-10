import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { parser: tsparser, parserOptions: { project: './tsconfig.json' } },
    plugins: { '@typescript-eslint': tseslint },
    rules: { ...tseslint.configs['recommended'].rules, '@typescript-eslint/no-explicit-any': 'error' },
  },
];
