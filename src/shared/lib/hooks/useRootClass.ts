import {
  IS_ANDROID,
  IS_APPLE,
  IS_APPLE_MOBILE,
  IS_FIREFOX,
  IS_MOBILE,
  IS_OVERLAY_SCROLL_SUPPORTED,
  IS_SAFARI,
  USE_CUSTOM_SCROLL,
  USE_NATIVE_SCROLL
} from '@/shared/lib/helpers/environment'

/**
 * Stamps environment classes on <html> once at boot so global stylesheets can
 * branch on them (`html.overlay-scroll .scrollable`, `html.is-firefox`, ...).
 * `is-tauri` is NOT stamped here — the titlebar feature lib does that at module
 * load (see features/layouts/titlebar/lib/is-tauri.ts) so the desktop build
 * drops the document scrollbar before any component mounts.
 */
export const useRootClass = () => {
  const add: string[] = []

  if (USE_NATIVE_SCROLL) {
    add.push('native-scroll')
  } else if (IS_OVERLAY_SCROLL_SUPPORTED) {
    add.push('overlay-scroll')
  } else if (USE_CUSTOM_SCROLL) {
    add.push('custom-scroll')
  }

  if (IS_FIREFOX) {
    add.push('is-firefox')
  }
  if (IS_MOBILE) {
    add.push('is-mobile')
  }

  if (IS_APPLE) {
    if (IS_SAFARI) {
      add.push('is-safari')
    }
    add.push(IS_APPLE_MOBILE ? 'is-ios' : 'is-mac')
  } else if (IS_ANDROID) {
    add.push('is-android')
  }

  document.documentElement.classList.add(...add)
}
