import { ref, reactive, watch } from 'vue'
import { useCookies } from '@vueuse/integrations/useCookies'
import { useModal } from '@/entities/modal/model/store'
import { CookieType } from '@/features/modal/cookie/model/types/cookie'
import { Cookie } from 'universal-cookie'

const COOKIE_NAMES: Record<CookieType, string> = {
  [CookieType.METRICS]: 'yandex_metrics',
  [CookieType.SECURITY]: 'access_token'
}

export const useCookieManager = () => {
  const { get, set, remove } = useCookies(Object.values(COOKIE_NAMES))
  const getCookie = (type: CookieType): Cookie => ({
    name: COOKIE_NAMES[type],
    enabled: !!get(COOKIE_NAMES[type]),
    type
  })
  const setCookie = (cookie: Cookie): void => {
    if (cookie.enabled) {
      set(cookie.name, 'enabled')
    } else {
      remove(cookie.name)
    }
  }
  return { getCookie, setCookie }
}
export const useCookieStore = () => {
  const { getCookie, setCookie } = useCookieManager()
  const cookies = reactive<Record<CookieType, Cookie>>({
    [CookieType.SECURITY]: getCookie(CookieType.SECURITY),
    [CookieType.METRICS]: getCookie(CookieType.METRICS)
  })
  const updateCookie = (cookie: Cookie): void => {
    setCookie(cookie)
  }
  return { cookies, updateCookie }
}

export const useCookieConsentLogic = () => {
  const { cookies, updateCookie } = useCookieStore()
  const modalStore = useModal()
  const showDefaultView = ref(true)

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

export const useCookiesConsent = () => {
  const {
    cookies,
    showDefaultView,
    toggleView,
    acceptAllCookies,
    rejectNonEssentialCookies,
    acceptSelectedCookies
  } = useCookieConsentLogic()

  return {
    cookies,
    showDefaultView,
    toggleView,
    acceptAllCookies,
    rejectNonEssentialCookies,
    acceptSelectedCookies
  }
}
