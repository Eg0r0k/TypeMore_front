import { InstallOptions } from 'vue3-recaptcha-v2/dist/types'

export const recaptchaOptions: InstallOptions = {
  sitekey: import.meta.env.VITE_RECAPTCHA_KEY,
  cnDomains: false
}
