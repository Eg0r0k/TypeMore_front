/**
 * Turnstile configuration, read lazily from the environment.
 *
 * `VITE_TURNSTILE_SITE_KEY` absent (or blank) is the DEV DEFAULT and means the
 * captcha is disabled end to end: nothing renders, nothing is sent, and the
 * auth forms behave exactly as they did before Turnstile existed. It mirrors
 * the backend's empty `TYPEMORE_TURNSTILE_SECRET`.
 *
 * Both are functions rather than consts so the value is read at call time —
 * module-eval consts would freeze whatever the environment looked like at
 * import, which no test (and no runtime env swap) could ever change.
 */

export const turnstileSiteKey = (): string => (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

export const isCaptchaEnabled = (): boolean => turnstileSiteKey().length > 0
