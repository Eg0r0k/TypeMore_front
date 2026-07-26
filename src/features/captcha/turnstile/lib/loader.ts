/**
 * The one place Cloudflare's Turnstile script is fetched.
 *
 * The tag is injected by the widget itself, on demand — so the script only
 * ever lands on a route that actually renders a captcha (the auth pages) and
 * never on the game or board routes, which stay untouched.
 *
 * Idempotent by construction: the in-flight promise is memoized, so N widgets
 * mounting on one page share a single `<script>` and a single API handle. A
 * failed load clears the memo, leaving a later attempt free to retry.
 */

export interface TurnstileRenderOptions {
  sitekey: string
  /** Turnstile's own enum — the only styling knob it exposes. */
  theme?: 'auto' | 'dark' | 'light'
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    /** Named in the script URL below; Turnstile calls it once its API is live. */
    __tmTurnstileReady?: () => void
  }
}

const READY_CALLBACK = '__tmTurnstileReady'
const SCRIPT_ID = 'cf-turnstile-api'
const SCRIPT_SRC = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${READY_CALLBACK}`

let loading: Promise<TurnstileApi> | null = null

/** Resolves once `window.turnstile` is usable. Safe to call any number of times. */
export const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading

  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const fail = (message: string) => {
      // Drop the memo so a later mount (back online, ad-blocker disabled) may retry.
      loading = null
      delete window.__tmTurnstileReady
      reject(new Error(message))
    }

    window.__tmTurnstileReady = () => {
      delete window.__tmTurnstileReady
      if (window.turnstile) resolve(window.turnstile)
      else fail('Turnstile signalled ready without exposing its API')
    }

    // A tag may already exist from a previous, still-pending load whose memo was
    // dropped; reuse it rather than stacking a second copy of the same script.
    if (document.getElementById(SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener(
      'error',
      () => {
        script.remove()
        fail('Failed to load the Turnstile script')
      },
      { once: true }
    )
    document.head.appendChild(script)
  })

  return loading
}
