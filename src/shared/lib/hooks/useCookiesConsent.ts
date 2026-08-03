import { ref, reactive, watch } from 'vue'
import { useCookies } from '@vueuse/integrations/useCookies'
import { CookieType } from '@/features/modal/cookie/model/types/cookie'
import type { Cookie } from 'universal-cookie'

const COOKIE_NAMES: Record<CookieType, string> = {
  [CookieType.METRICS]: 'yandex_metrics',
  [CookieType.SECURITY]: 'access_token'
}

export const useCookiesConsent = (onDone?: () => void) => {
  const { get, set, remove } = useCookies(Object.values(COOKIE_NAMES))
  const readCookie = (type: CookieType): Cookie => ({
    name: COOKIE_NAMES[type],
    enabled: !!get(COOKIE_NAMES[type]),
    type
  })
  const writeCookie = (cookie: Cookie): void => {
    if (cookie.enabled) {
      set(cookie.name, 'enabled')
    } else {
      remove(cookie.name)
    }
  }

  const cookies = reactive<Record<CookieType, Cookie>>({
    [CookieType.SECURITY]: readCookie(CookieType.SECURITY),
    [CookieType.METRICS]: readCookie(CookieType.METRICS)
  })
  const showDefaultView = ref(true)

  // `enabled` is the only field that ever mutates (name/type are fixed), so
  // watching the flags directly replaces the old deep watch over the whole
  // record — same triggers, no deep traversal per change.
  watch(
    () => Object.values(cookies).map((cookie) => cookie.enabled),
    () => {
      Object.values(cookies).forEach(writeCookie)
    }
  )

  const setConsentFlag = () => {
    localStorage.setItem('cookieConsentGiven', 'true')
  }

  const toggleView = () => {
    showDefaultView.value = !showDefaultView.value
  }

  const acceptAllCookies = () => {
    Object.values(cookies).forEach((cookie) => {
      cookie.enabled = true
      writeCookie(cookie)
    })
    setConsentFlag()
    onDone?.()
  }

  const rejectNonEssentialCookies = () => {
    cookies[CookieType.METRICS].enabled = false
    cookies[CookieType.SECURITY].enabled = true
    writeCookie(cookies[CookieType.SECURITY])
    writeCookie(cookies[CookieType.METRICS])
    setConsentFlag()
    onDone?.()
  }

  const acceptSelectedCookies = () => {
    Object.values(cookies).forEach(writeCookie)
    setConsentFlag()
    onDone?.()
  }

  return {
    cookies,
    showDefaultView,
    toggleView,
    acceptAllCookies,
    rejectNonEssentialCookies,
    acceptSelectedCookies
  }
}
