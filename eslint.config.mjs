import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import css from '@eslint/css';

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
  eslint.configs.recommended,
  {
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
  // Server files configuration
  {
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
    ],
    files: ['src/server/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.server.json',
        tsconfigRootDir: import.meta.dirname,
        globals: {
          ...globals.node,
          ...globals.es6,
        },
      },
    },
    rules: {
      ...typeScriptRules
    }
  },
  // Client files configuration
  {
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
    ],
    files: ['src/client/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.client.json',
        tsconfigRootDir: import.meta.dirname,
        globals: {
          ...globals.browser,
          ...globals.es6,
        },
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