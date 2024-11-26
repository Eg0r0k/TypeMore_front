import './app/main.scss'
import { createApp, nextTick, defineAsyncComponent } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './app/App.vue'
import router from './app/router'
import { install } from 'vue3-recaptcha-v2'
import { InstallOptions } from 'vue3-recaptcha-v2/dist/types'
import { VueQueryPlugin } from '@tanstack/vue-query'

import '@splidejs/vue-splide/css/core'

const app = createApp(App)

app.directive('focus', {
  mounted: (el: HTMLInputElement) => {
    nextTick(() => el.focus())
  }
})
const options: InstallOptions = {
  sitekey: import.meta.env.VITE_RECAPTCHA_KEY,
  cnDomains: false
}
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(install, options)
app.use(pinia)
app.use(router)
app.use(VueQueryPlugin)

const AsyncVueSplide = defineAsyncComponent(() => import('@splidejs/vue-splide'))
const AsyncPopper = defineAsyncComponent(() => import('vue3-popper'))

app.component('Popper', AsyncPopper)
app.use(AsyncVueSplide)

app.mount('#app')
