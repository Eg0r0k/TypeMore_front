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

// Set by `tauri dev` when targeting a physical device: the webview then loads the
// dev server over the LAN, so HMR has to advertise that address instead of localhost.
const tauriHost = process.env.TAURI_DEV_HOST

export default defineConfig({
  // Tauri owns the terminal during `tauri dev`; Vite must not wipe its output.
  clearScreen: false,
  // TAURI_ENV_* carries the target platform/arch into the frontend build.
  envPrefix: ['VITE_', 'TAURI_ENV_'],
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
    host: tauriHost || '0.0.0.0',
    // The project's port, and Tauri's `devUrl` follows IT rather than the other
    // way round: the API server's CORS allowlist is keyed on this origin, so
    // moving the dev server moves the app off the allowlist and every request
    // fails preflight.
    port: 5173,
    strictPort: true,
    hmr: tauriHost ? { protocol: 'ws', host: tauriHost, port: 5174 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
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
