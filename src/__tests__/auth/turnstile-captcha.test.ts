/**
 * The Turnstile gate on the abuse-prone auth forms.
 *
 * The contract has two halves and both are load-bearing: with a site key the
 * form MUST NOT submit until Turnstile hands over a token, and without one the
 * request body must stay byte-identical to its pre-captcha shape. The third
 * rule is subtler — a Turnstile token is single-use, so a `captcha_failed`
 * answer has to reset the widget or the user's retry silently replays a spent
 * token.
 *
 * Cloudflare's script is never fetched here: `window.turnstile` is stubbed, and
 * the one test that exercises the loader intercepts the injection.
 *
 * Fake timers are mandatory, not cosmetic: vee-validate debounces every
 * schema-level validation by 5 ms (`debounceAsync(_validateSchema, 5)`), so a
 * `flushPromises()` alone leaves `handleSubmit` awaiting a timer that never
 * fires and the submission silently never happens.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n } from '@app/i18n'
import en from '@app/i18n/locales/en'
import type { TurnstileApi, TurnstileRenderOptions } from '@/features/captcha/turnstile/lib/loader'

const SITE_KEY = '1x00000000000000000000AA'

const h = vi.hoisted(() => ({ register: vi.fn(), resetRequest: vi.fn(), resend: vi.fn() }))

vi.mock('@shared/api', async () => {
  // Dynamic import: `vi.mock` factories are hoisted above every static import,
  // so this is the only way to reach `ref` from inside one.
  const { ref } = await import('vue')
  class ApiError extends Error {
    status: number
    code: string
    constructor(shape: { status: number; code: string }) {
      super(shape.code)
      this.status = shape.status
      this.code = shape.code
    }
  }
  return {
    ApiError,
    isApiError: (value: unknown) => value instanceof ApiError,
    useRegisterMutation: () => ({ mutateAsync: h.register, isPending: ref(false) }),
    usePasswordResetRequestMutation: () => ({ mutateAsync: h.resetRequest, isPending: ref(false) }),
    useResendVerificationMutation: () => ({ mutateAsync: h.resend, isPending: ref(false) }),
    useVerifyMutation: () => ({ mutateAsync: vi.fn().mockRejectedValue(new Error('no token')) })
  }
})

import { ApiError } from '@shared/api'
import RegisterPage from '@/pages/auth/register/ui.vue'
import ResetPage from '@/pages/auth/reset/ui.vue'
import VerifyPage from '@/pages/auth/verify/ui.vue'

/** Stands in for Cloudflare's global; `rendered` is the options it was handed. */
let rendered: TurnstileRenderOptions | null = null
const turnstile = {
  render: vi.fn((_container: HTMLElement, options: TurnstileRenderOptions) => {
    rendered = options
    return 'widget-1'
  }),
  reset: vi.fn(),
  remove: vi.fn()
} satisfies TurnstileApi

/** Drains microtasks AND vee-validate's 5 ms validation debounce. */
const settle = () => vi.advanceTimersByTimeAsync(20)

/** The verify page reads `route.query.token`, so a real (memory) router is required. */
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', name: 'catch-all', component: { template: '<div />' } }]
})

const mountPage = (component: unknown) =>
  mount(component as never, {
    global: { plugins: [i18n, router], stubs: { RouterLink: true } }
  })

const setField = async (wrapper: VueWrapper, name: string, value: string) => {
  await wrapper.find(`input[name="${name}"]`).setValue(value)
  await settle()
}

const fillRegister = async (wrapper: VueWrapper) => {
  await setField(wrapper, 'name', 'tester')
  await setField(wrapper, 'email', 'a@b.co')
  await setField(wrapper, 'password', 'password123')
}

const submit = async (wrapper: VueWrapper) => {
  await wrapper.find('form').trigger('submit')
  await settle()
}

const handToken = async (token: string) => {
  rendered?.callback?.(token)
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers()
  rendered = null
  turnstile.render.mockClear()
  turnstile.reset.mockClear()
  turnstile.remove.mockClear()
  h.register.mockReset()
  h.resetRequest.mockReset()
  h.resend.mockReset()
  i18n.global.locale.value = 'en'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  delete window.turnstile
})

describe('register with a site key configured', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY)
    window.turnstile = turnstile
  })

  it('renders the widget with the configured key and Turnstile\u2019s dark theme', async () => {
    mountPage(RegisterPage)
    await settle()

    expect(turnstile.render).toHaveBeenCalledTimes(1)
    expect(rendered?.sitekey).toBe(SITE_KEY)
    expect(rendered?.theme).toBe('dark')
  })

  it('blocks submit until a token arrives, then sends it as turnstileToken', async () => {
    const wrapper = mountPage(RegisterPage)
    await settle()
    await fillRegister(wrapper)

    // Every other field is valid; only the missing token stands in the way.
    await submit(wrapper)
    expect(h.register).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(en.auth.captcha.required)

    await handToken('token-abc')
    await submit(wrapper)

    expect(h.register).toHaveBeenCalledTimes(1)
    expect(h.register).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'password123',
      name: 'tester',
      turnstileToken: 'token-abc'
    })
  })

  it('surfaces captcha_failed, resets the widget, and re-blocks submit', async () => {
    h.register.mockRejectedValueOnce(new ApiError({ status: 400, code: 'captcha_failed' }))

    const wrapper = mountPage(RegisterPage)
    await settle()
    await fillRegister(wrapper)
    await handToken('spent-token')
    await submit(wrapper)

    expect(wrapper.text()).toContain(en.auth.captcha.failed)
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')

    // The spent token went with the reset, so a blind retry cannot replay it.
    await submit(wrapper)
    expect(h.register).toHaveBeenCalledTimes(1)
  })

  it('treats captcha_required the same way \u2014 a reset, not a dead end', async () => {
    h.register.mockRejectedValueOnce(new ApiError({ status: 400, code: 'captcha_required' }))

    const wrapper = mountPage(RegisterPage)
    await settle()
    await fillRegister(wrapper)
    await handToken('token-abc')
    await submit(wrapper)

    expect(wrapper.text()).toContain(en.auth.captcha.failed)
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')
  })

  it('leaves the non-captcha error table alone', async () => {
    h.register.mockRejectedValueOnce(new ApiError({ status: 409, code: 'name_taken' }))

    const wrapper = mountPage(RegisterPage)
    await settle()
    await fillRegister(wrapper)
    await handToken('token-abc')
    await submit(wrapper)

    expect(wrapper.text()).toContain(en.auth.register.nameTaken)
    expect(turnstile.reset).not.toHaveBeenCalled()
  })
})

describe('register with no site key', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    window.turnstile = turnstile
  })

  it('renders no widget and sends the pre-captcha body verbatim', async () => {
    const wrapper = mountPage(RegisterPage)
    await settle()

    expect(wrapper.find('.turnstile').exists()).toBe(false)
    expect(turnstile.render).not.toHaveBeenCalled()

    await fillRegister(wrapper)
    await submit(wrapper)

    expect(h.register).toHaveBeenCalledTimes(1)
    // Byte-identical, not merely equivalent: no `turnstileToken` key at all.
    expect(JSON.stringify(h.register.mock.calls[0]?.[0])).toBe(
      '{"email":"a@b.co","password":"password123","name":"tester"}'
    )
  })
})

describe('password reset request', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY)
    window.turnstile = turnstile
  })

  it('carries the token', async () => {
    const wrapper = mountPage(ResetPage)
    await settle()
    await setField(wrapper, 'email', 'a@b.co')
    await handToken('token-abc')
    await submit(wrapper)

    expect(h.resetRequest).toHaveBeenCalledWith({
      email: 'a@b.co',
      turnstileToken: 'token-abc'
    })
    expect(wrapper.text()).toContain(en.auth.reset.sent)
  })

  it('does not swallow captcha_failed into the anti-enumeration success copy', async () => {
    h.resetRequest.mockRejectedValueOnce(new ApiError({ status: 400, code: 'captcha_failed' }))

    const wrapper = mountPage(ResetPage)
    await settle()
    await setField(wrapper, 'email', 'a@b.co')
    await handToken('spent-token')
    await submit(wrapper)

    expect(wrapper.text()).toContain(en.auth.captcha.failed)
    expect(wrapper.text()).not.toContain(en.auth.reset.sent)
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')
  })

  it('still swallows every other failure \u2014 the address must stay unknowable', async () => {
    h.resetRequest.mockRejectedValueOnce(new ApiError({ status: 429, code: 'rate_limited' }))

    const wrapper = mountPage(ResetPage)
    await settle()
    await setField(wrapper, 'email', 'a@b.co')
    await handToken('token-abc')
    await submit(wrapper)

    expect(wrapper.text()).toContain(en.auth.reset.sent)
    expect(turnstile.reset).not.toHaveBeenCalled()
  })
})

describe('verification resend', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY)
    window.turnstile = turnstile
  })

  it('offers the form once verification failed, and carries the token', async () => {
    // No `?token=` in the route, so the page lands in its `missing` state, which
    // is exactly where a new link is worth asking for.
    const wrapper = mountPage(VerifyPage)
    await settle()

    await setField(wrapper, 'email', 'a@b.co')
    await handToken('token-abc')
    await submit(wrapper)

    expect(h.resend).toHaveBeenCalledWith({ email: 'a@b.co', turnstileToken: 'token-abc' })
    expect(wrapper.text()).toContain(en.auth.verify.resendSent)
  })

  it('surfaces captcha_failed and resets the widget', async () => {
    h.resend.mockRejectedValueOnce(new ApiError({ status: 400, code: 'captcha_failed' }))

    const wrapper = mountPage(VerifyPage)
    await settle()
    await setField(wrapper, 'email', 'a@b.co')
    await handToken('spent-token')
    await submit(wrapper)

    expect(wrapper.text()).toContain(en.auth.captcha.failed)
    expect(wrapper.text()).not.toContain(en.auth.verify.resendSent)
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1')
  })
})

describe('script loader', () => {
  it('injects the tag once however many widgets ask for it', async () => {
    vi.resetModules()
    delete window.turnstile

    const appended: Node[] = []
    const spy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation(<T extends Node>(node: T): T => {
        appended.push(node)
        return node
      })

    // Dynamic import: the loader memoizes its in-flight promise in module state,
    // so this test only means anything against the registry reset above.
    const { loadTurnstile } = await import('@/features/captcha/turnstile/lib/loader')
    const first = loadTurnstile()
    const second = loadTurnstile()

    expect(first).toBe(second)
    expect(appended).toHaveLength(1)
    expect((appended[0] as HTMLScriptElement).src).toContain('challenges.cloudflare.com')

    window.turnstile = turnstile
    window.__tmTurnstileReady?.()
    await expect(first).resolves.toBe(turnstile)

    spy.mockRestore()
  })
})
