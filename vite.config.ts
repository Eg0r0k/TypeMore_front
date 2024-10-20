import { fileURLToPath, URL } from 'node:url'
import { dirname } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { FontaineTransform } from 'fontaine'
const options = {
  fallbacks: ['BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'Noto Sans'],
  resolvePath: () => `file://${dirname(fileURLToPath(new URL(import.meta.url)))}public`
}
export default defineConfig({
  plugins: [vue(), vueJsx(), FontaineTransform.vite(options)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url))
    }
  }
})
