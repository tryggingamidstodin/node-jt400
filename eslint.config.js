import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  {
    ignores: ['dist-cjs/**', 'dist-esm/**', 'java/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['ts-src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      'prefer-rest-params': 'off',
      'space-before-function-paren': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'comma-dangle': ['error', 'always-multiline'],
      'no-eval': 'off',
      'no-use-before-define': 'off',
      'no-tabs': 'off',
      indent: ['error', 2],
    },
  },
  {
    files: ['ts-src/**/*spec.ts'],
    rules: {
      // node:test's describe/it return promises the runner handles.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
)
