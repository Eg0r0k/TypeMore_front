import { useTitle } from '@vueuse/core'
import { RouteLocationNormalizedLoaded } from 'vue-router'

export function setPageTitle(to: RouteLocationNormalizedLoaded) {
  const title = to.meta.title ? `Type More | ${to.meta.title}` : 'Type More | Typing speed training'
  useTitle(title)
}
