import type { App } from 'vue'

import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from '@shared/api'
import { MotionPlugin } from '@vueuse/motion'
import { i18n } from '@app/i18n'
import vMaxChars from '@shared/directives/vMaxChars'
import vSelect from '@shared/directives/vSelect'
import vFocus from '@shared/directives/vFocus'

export const installPlugins = (app: App) => {
  const pinia = createPinia()
  app.use(pinia)
  pinia.use(piniaPluginPersistedstate)
  // One client app-wide: router guards and pinia actions read the very same
  // cache the components do (see `shared/api/query-client.ts`).
  app.use(VueQueryPlugin, { queryClient })
  app.use(MotionPlugin)
  app.use(i18n)
  app.directive('focus', vFocus)
  app.directive('max-chars', vMaxChars)
  app.directive('select', vSelect)
}
