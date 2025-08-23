import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import pluginQuery from '@tanstack/eslint-plugin-query'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 統一導入路徑規則：禁止深層導入 hooks
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/hooks/*/*'],
              message: '請使用統一導入路徑：import { ... } from "@/hooks"'
            },
            {
              group: ['../hooks/utils/*', './utils/*'],
              message: '請使用統一導入路徑：import { ... } from "@/hooks"'
            }
          ]
        }
      ]
    }
  },
  // TanStack Query ESLint 推薦規則
  ...pluginQuery.configs['flat/recommended'],
])
