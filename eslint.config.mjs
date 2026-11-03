import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'legacy/**',
      'node_modules/**',
      'public/assets/**',
      'data/**',
      'build/**',
      '.wrangler/**',
      'out/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/client/**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'tests/**/*.{js,mjs}', '*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
