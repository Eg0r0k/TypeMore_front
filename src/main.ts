import '@app/main.scss'
import '@app/tailwind.css'
import { createApp } from 'vue'
import App from '@app/App.vue'
import router from '@app/router'
import { installPlugins } from './plugins'

const app = createApp(App)

installPlugins(app)
app.use(router)

router.isReady()
app.mount('#app')
