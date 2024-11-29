import type { App } from 'vue'

import { createPinia } from 'pinia'
import { install as VueReCaptcha } from 'vue3-recaptcha-v2'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { recaptchaOptions } from './shared/constants/recaptcha.config'
import { VueQueryPlugin } from '@tanstack/vue-query'
import vMaxChars from './shared/directives/vMaxChars'
import VFocus from './shared/directives/VFocus'

export const installPlugins = (app: App) => {
  const pinia = createPinia()
  app.use(pinia)
  pinia.use(piniaPluginPersistedstate)
  app.use(VueReCaptcha, recaptchaOptions)
  app.use(VueQueryPlugin)
  app.directive('focus', VFocus)
  app.directive('max-chars', vMaxChars)
}
