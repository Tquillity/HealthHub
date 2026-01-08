import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/dist/',
      '**/build/',
      '**/.turbo/',
      '**/.next/',
      '**/node_modules/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
    languageOptions: {
      globals: {
        browser: true,
        es2020: true,
        console: true,
        fetch: true,
        URL: true,
        Response: true,
        caches: true,
        self: true,
        clients: true,
      },
    },
  },
  {
    files: ['postcss.config.js', '*.config.js'],
    languageOptions: {
      globals: {
        module: true,
        require: true,
        process: true,
        __dirname: true,
        __filename: true,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  prettierConfig, // Must be last to override other configs
];
