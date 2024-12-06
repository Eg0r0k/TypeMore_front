import type { App } from 'vue'

import { createPinia } from 'pinia'
import { install as VueReCaptcha } from 'vue3-recaptcha-v2'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { recaptchaOptions } from '@shared/constants/recaptcha.config'
import { VueQueryPlugin } from '@tanstack/vue-query'
import vMaxChars from '@shared/directives/vMaxChars'
import vSelect from '@shared/directives/vSelect'
import vFocus from '@shared/directives/vFocus'

export const installPlugins = (app: App) => {
  const pinia = createPinia()
  app.use(pinia)
  pinia.use(piniaPluginPersistedstate)
  app.use(VueReCaptcha, recaptchaOptions)
  app.use(VueQueryPlugin)
  app.directive('focus', vFocus)
  app.directive('max-chars', vMaxChars)
  app.directive('select', vSelect)
}
