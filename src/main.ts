import './app/main.scss'
import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import VueSplide from '@splidejs/vue-splide'
import App from './app/App.vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './app/router'
import { install } from 'vue3-recaptcha-v2'
import { InstallOptions } from 'vue3-recaptcha-v2/dist/types'
import Popper from 'vue3-popper'

// or only core styles
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
app.component('Popper', Popper)
app.use(VueSplide)
app.mount('#app')
