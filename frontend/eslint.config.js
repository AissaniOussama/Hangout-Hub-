// ESLint flat config (ESLint v9+)
// Covers Vue 3 SFCs and TypeScript files.
import js from '@eslint/js'
import ts from 'typescript-eslint'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default [
  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...ts.configs.recommended,

  // Vue 3 rules
  ...vuePlugin.configs['flat/recommended'],

  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: ts.parser,
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      // Allow unused vars prefixed with _ (common pattern for ignored params)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Prefer const over let where possible
      'prefer-const': 'warn',
      // Vue: require explicit component names
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    // Ignore build output and node_modules
    ignores: ['dist/**', 'node_modules/**'],
  },
]
