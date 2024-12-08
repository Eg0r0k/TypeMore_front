import '@app/main.scss'
import { createApp, defineAsyncComponent } from 'vue'
import App from '@app/App.vue'
import router from '@app/router'
import '@splidejs/vue-splide/css/core'
import { installPlugins } from './plugins'

const app = createApp(App)


installPlugins(app)
app.use(router)

router.isReady()
const AsyncVueSplide = defineAsyncComponent(() => import('@splidejs/vue-splide'))
const AsyncPopper = defineAsyncComponent(() => import('vue3-popper'))

app.component('Popper', AsyncPopper)
app.use(AsyncVueSplide)

app.mount('#app')
