import './app/main.scss'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './app/App.vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import router from './app/router'
import { install } from 'vue3-recaptcha-v2'
import { InstallOptions } from 'vue3-recaptcha-v2/dist/types'
import Popper from 'vue3-popper'
const app = createApp(App)
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

app.mount('#app')
