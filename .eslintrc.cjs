/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    'prettier',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
    'plugin:storybook/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  plugins: ['vue', '@typescript-eslint', 'storybook', 'import', 'vuejs-accessibility', 'security'],
  rules: {
    'vue/multi-word-component-names': 'off',
    eqeqeq: 'error',
    'vue/max-attributes-per-line': [
      'error',
      {
        singleline: 1, // Один атрибут на одной строке для однострочного элемента
        multiline: {
          max: 1, // Один атрибут на строку для многострочных элементов
          allowFirstLine: false
        }
      }
    ]
  }
}
