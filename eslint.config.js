import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'
import pluginSecurity from 'eslint-plugin-security'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// Accessibility linting is adopted incrementally: surface every a11y issue as a
// warning (visible, non-blocking) rather than failing the build on pre-existing debt.
const a11yWarnings = Object.fromEntries(
  Object.keys(pluginVueA11y.rules).map((rule) => [`vuejs-accessibility/${rule}`, 'warn'])
)

export default defineConfigWithVueTs(
  {
    name: 'app/ignores',
    ignores: ['dist/**', 'coverage/**', 'public/**', '*.timestamp-*.mjs', 'stats.html']
  },
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  pluginVueA11y.configs['flat/recommended'],
  pluginSecurity.configs.recommended,
  skipFormatting,

  { name: 'app/a11y-severity', rules: a11yWarnings },

  {
    name: 'app/rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      // Fires on every bracket access with a dynamic key; too noisy for this codebase.
      'security/detect-object-injection': 'off',
      eqeqeq: 'error'
    }
  }
)
