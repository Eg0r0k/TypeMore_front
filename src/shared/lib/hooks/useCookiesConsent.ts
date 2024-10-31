import { ref, reactive, watch } from 'vue'
import { useCookies } from '@vueuse/integrations/useCookies'
import { useModal } from '@/entities/modal/model/store'
import { CookieType } from '@/features/modal/cookie/model/types/cookie'
import { Cookie } from 'universal-cookie'

const COOKIE_NAMES: Record<CookieType, string> = {
  [CookieType.METRICS]: 'yandex_metrics',
  [CookieType.SECURITY]: 'access_token'
}

export function useCookiesConsent() {
  const { get, set, remove } = useCookies([
    COOKIE_NAMES[CookieType.METRICS],
    COOKIE_NAMES[CookieType.SECURITY]
  ])
  const modalStore = useModal()
  const showDefaultView = ref(true)

  const cookies = reactive<Record<CookieType, Cookie>>({
    [CookieType.SECURITY]: {
      name: COOKIE_NAMES[CookieType.SECURITY],
      enabled: !!get(COOKIE_NAMES[CookieType.SECURITY]),
      type: CookieType.SECURITY
    },
    [CookieType.METRICS]: {
      name: COOKIE_NAMES[CookieType.METRICS],
      enabled: !!get(COOKIE_NAMES[CookieType.METRICS]),
      type: CookieType.METRICS
    }
  })

  const updateCookie = (cookie: Cookie) => {
    if (cookie.enabled) {
      set(cookie.name, 'enabled')
    } else {
      remove(cookie.name)
    }
  }

  watch(
    () => Object.values(cookies),
    (updatedCookies) => {
      updatedCookies.forEach(updateCookie)
    },
    { deep: true }
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
      updateCookie(cookie)
    })
    setConsentFlag()
    modalStore.close()
  }

  const rejectNonEssentialCookies = () => {
    cookies[CookieType.METRICS].enabled = false
    cookies[CookieType.SECURITY].enabled = true
    updateCookie(cookies[CookieType.SECURITY])
    updateCookie(cookies[CookieType.METRICS])
    setConsentFlag()
    modalStore.close()
  }

  const acceptSelectedCookies = () => {
    Object.values(cookies).forEach(updateCookie)
    setConsentFlag()
    modalStore.close()
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
