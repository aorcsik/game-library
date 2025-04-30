import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import css from '@eslint/css';
import { flatConfig } from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { globalIgnores } from 'eslint/config';

const globalRules = {
  'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
  'quotes': ['error', 'single', { avoidEscape: true }],
  'semi': ['error', 'always'],
};

const typeScriptRules = {
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/explicit-function-return-type': 'warn',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
};

export default tseslint.config(
  globalIgnores([
    'node_modules/*',
    'out/*',
    'build/*',
    '.next/*'
  ]),
  flatConfig.recommended,
  {
    ...eslint.configs.recommended,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...globalRules
    },
  },
  // JavaScript files
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
  },
  // Next.js
  {
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      reactPlugin.configs.flat.recommended,
      reactPlugin.configs.flat['jsx-runtime'],
      reactHooks.configs['recommended-latest']
    ],
    files: ['src/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.es6,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...typeScriptRules
    }
  },
  // CSS files configuration
  {
    files: ['**/*.css'],
    plugins: {
        css,
    },
    language: 'css/css',
    rules: {
        'css/no-duplicate-imports': 'error',
    },
},
);