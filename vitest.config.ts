import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

// Binary media assets (`/static/sounds/*.mp3|wav`) are imported by components for
// sound playback. They are irrelevant to logic tests and cannot be resolved by the
// test transform (they live in the public dir), so stub them to an empty module.
const stubMediaAssets = (): Plugin => {
  const VIRTUAL = '\0virtual:media-asset-stub'
  return {
    name: 'stub-media-assets',
    enforce: 'pre',
    resolveId(id) {
      if (/\.(mp3|wav|ogg|m4a|flac)$/.test(id)) return VIRTUAL
    },
    load(id) {
      if (id === VIRTUAL) return 'export default ""'
    }
  }
}

// Reuses the Vite pipeline (aliases, SCSS mixin injection, plugins) so components
// compile in tests exactly as they do in the app.
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [stubMediaAssets()],
    test: {
      // Two projects, one run: the app suite and the extracted @typemore/core
      // suite. `vitest run` at the root executes both, so the workspace-wide
      // green is still a single command and a single summary.
      projects: [
        {
          // Inherit THIS file's pipeline (Vue plugins, aliases, media stubs) —
          // the app tests compile exactly as before the extraction.
          extends: true,
          test: {
            name: 'web',
            environment: 'happy-dom',
            // Project convention: explicit imports (`import { describe, it, expect } from 'vitest'`),
            // so global test APIs stay disabled.
            globals: false,
            include: ['src/**/*.{test,spec}.{ts,tsx}'],
            exclude: [...configDefaults.exclude, 'e2e/**', 'dist/**'],
            root: fileURLToPath(new URL('./', import.meta.url))
          }
        },
        // Uses packages/core/vitest.config.ts (no Vue pipeline needed there).
        'packages/core'
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/main.ts', 'env.d.ts']
      }
    }
  })
)
