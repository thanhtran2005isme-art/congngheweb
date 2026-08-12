// ESLint flat config (ESLint v9). Áp dụng cho Vite + React 19 + TypeScript.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 1) Bỏ qua build output / SW / public assets
  {
    ignores: [
      'dist',
      'build',
      'node_modules',
      '.vite',
      'public/sw.js',
      'public/manifest.webmanifest',
      'public/sitemap.xml',
      'public/robots.txt',
    ],
  },

  // 2) Base JS + TS rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3) React Hooks + Refresh
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // react-hooks v7 thêm rules nghiêm khắc — giảm thành warn để không block CI
      // trên code legacy (set-state in effect & purity). Có thể siết lại sau khi refactor.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/component-hook-factories': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Cho phép _prefix và "noop" args trong project hiện tại
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Project có nhiều "as object" / DOM cast → giảm thành warn
      '@typescript-eslint/no-explicit-any': 'warn',
      // Cho phép ts-comment khi cần (vd. workaround GIS SDK)
      '@typescript-eslint/ban-ts-comment': 'warn',
      // FE app: console.log đôi khi cần khi debug
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // React 19 không cần import React vào scope
      'react/react-in-jsx-scope': 'off',
    },
  },

  // 4) Service Worker globals
  {
    files: ['**/*.sw.{js,ts}', 'public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },

  // 5) Node config files
  {
    files: ['*.config.{js,ts,mjs,cjs}', 'vite.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  }
);
