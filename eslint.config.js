import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vuePlugin from 'eslint-plugin-vue';

const globals = {
  process: 'readonly',
  window: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  fetch: 'readonly',
  Blob: 'readonly',
  FormData: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  AbortSignal: 'readonly',
  RequestInit: 'readonly',
};

export default [
  { ignores: ['dist/**', '.quasar/**', 'node_modules/**', 'src-capacitor/**', 'src-pwa/**', 'legacy/**'] },
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  // Fichiers TypeScript : parser TS au niveau languageOptions.parser.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals,
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off', // TypeScript gère la résolution des symboles.
      'no-unused-vars': 'off', // remplacé par la règle TS.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // Fichiers Vue : le parser vue vient de flat/recommended ; on lui branche TS
  // pour le <script lang="ts">.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
      globals,
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
];
