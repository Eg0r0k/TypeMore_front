import { fileURLToPath, URL } from 'node:url'
import { dirname } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { visualizer } from 'rollup-plugin-visualizer'
import { FontaineTransform } from 'fontaine'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
const options = {
  fallbacks: ['BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'Noto Sans'],
  resolvePath: () => `file://${dirname(fileURLToPath(new URL(import.meta.url)))}public`
}
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    vueJsx(),
    tailwindcss(),
    Icons({
      compiler: 'vue3',
      customCollections: {
        // Bespoke brand assets (not in Tabler) live here; the loader injects
        // `fill="currentColor"` so they inherit `color`. Consumed as `~icons/typemore/<file>`.
        typemore: FileSystemIconLoader('./src/shared/assets/icons', (svg) =>
          svg.replace(/^<svg /, '<svg fill="currentColor" ')
        )
      }
    }),
    FontaineTransform.vite(options),
    visualizer()
  ],
  define: {
    // vue-i18n tree-shaking: we use Composition API mode only, no prod devtools.
    __VUE_I18N_LEGACY_API__: 'false',
    __INTLIFY_PROD_DEVTOOLS__: 'false'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('html2canvas')) return 'html2canvas'
          if (id.includes('vue3-recaptcha-v2')) return 'rare'
          if (id.includes('/vue/') || id.includes('/vue-router/')) return 'vendor'
        }
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use  "@/app/_mixin.scss" as *;'
      }
    }
  }
})
