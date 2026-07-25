import { useTitle } from '@vueuse/core'
import type { RouteLocationNormalized } from 'vue-router'

const APP_NAME = 'Type More'

// Global middleware: sets the document title from `meta.title`. Returns nothing
// (void) so navigation always proceeds — the return-style vue-router idiom.
export function titleMiddleware(to: RouteLocationNormalized): void {
  useTitle(to.meta.title ? `${APP_NAME} | ${to.meta.title}` : `${APP_NAME} | Typing speed training`)
}
