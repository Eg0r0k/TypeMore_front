/**
 * The quote-mode UX of the room config panel: a fresh random quote on every
 * lobby (re)entry, a visible loader while a draw is in flight, and a TOAST —
 * not an inline note — when the corpus has nothing to give (the draw is
 * triggered from outside quote mode too, where the inline slot is not even
 * rendered; failing there used to look like a dead button).
 */
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  updateSettings: vi.fn(),
  addAlert: vi.fn(),
  loadRandomQuote: vi.fn()
}))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.session
}))
vi.mock('@/entities/alert', () => ({
  AlertType: { Error: 'error', Warning: 'warn' },
  useAlertStore: () => ({ addAlert: h.addAlert })
}))
vi.mock('@shared/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadRandomQuote: (...args: unknown[]) => h.loadRandomQuote(...args),
  isApiError: (error: unknown) =>
    typeof error === 'object' && error !== null && 'status' in error
}))

import { RoomConfig } from '@/features/room/config'

const quoteSettings = () => ({
  name: 'room',
  visibility: 'private' as const,
  mode: 'quote' as const,
  wordCount: 7,
  lang: 'english',
  dictHash: '',
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'quote' as const, quoteId: 'q-old' }
})

const player = (playerId: string) => ({
  playerId,
  nick: playerId,
  freemods: { difficulty: 'normal', minWpm: 0, nospace: false }
})

function makeSession(settings: Record<string, unknown> = quoteSettings()) {
  // TWO players on purpose: the host bootstrap only rewrites settings for a
  // freshly created single-seat room, and that path is not under test here.
  return reactive({
    isHost: true,
    selfId: 'me',
    room: { code: 'ABCD', players: [player('me'), player('p2')], settings },
    updateSettings: h.updateSettings,
    setFreemods: vi.fn()
  })
}

// The language-name hook runs a vue-query; a throwaway client (no retries)
// satisfies the injection, and the failing fetch just leaves names empty.
const mountConfig = () =>
  mount(RoomConfig, {
    global: {
      plugins: [
        i18n,
        createPinia(),
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
        ]
      ]
    }
  })

beforeEach(() => {
  h.updateSettings.mockReset()
  h.addAlert.mockReset()
  h.loadRandomQuote.mockReset()
})

describe('quote mode in the room config', () => {
  it('re-draws a fresh random quote on every lobby entry', async () => {
    h.session = makeSession()
    h.loadRandomQuote.mockResolvedValueOnce({ id: 'q-new', text: 'alpha beta gamma' })
    mountConfig()
    await flushPromises()

    expect(h.loadRandomQuote).toHaveBeenCalledOnce()
    expect(h.updateSettings).toHaveBeenCalledOnce()
    const sent = h.updateSettings.mock.calls[0][0]
    expect(sent.textSource).toEqual({ kind: 'quote', quoteId: 'q-new' })
    expect(sent.wordCount).toBe(3)
  })

  it('shows a loader while the draw is in flight', async () => {
    h.session = makeSession()
    // A draw that never lands — the panel must say so instead of playing dead.
    h.loadRandomQuote.mockReturnValueOnce(new Promise(() => {}))
    const wrapper = mountConfig()
    await flushPromises()

    expect(wrapper.find('[data-testid="quote-loader"]').exists()).toBe(true)
    expect(h.updateSettings).not.toHaveBeenCalled()
  })

  it('raises a toast when the corpus has no such quote', async () => {
    h.session = makeSession()
    h.loadRandomQuote.mockRejectedValueOnce({ status: 404 })
    const wrapper = mountConfig()
    await flushPromises()

    expect(h.updateSettings).not.toHaveBeenCalled()
    expect(h.addAlert).toHaveBeenCalledOnce()
    expect(h.addAlert.mock.calls[0][0].type).toBe('warn')
    // The loader is gone — the failure ended the flight.
    expect(wrapper.find('[data-testid="quote-loader"]').exists()).toBe(false)
  })

  it('does not draw for a guest, whatever the mode', async () => {
    const session = makeSession()
    session.isHost = false
    h.session = session
    mountConfig()
    await flushPromises()

    expect(h.loadRandomQuote).not.toHaveBeenCalled()
  })

  it('does not draw outside quote mode', async () => {
    h.session = makeSession({
      ...quoteSettings(),
      mode: 'time',
      durationMs: 30000,
      dictHash: 'abc123',
      textSource: { kind: 'seeded' }
    })
    mountConfig()
    await flushPromises()

    expect(h.loadRandomQuote).not.toHaveBeenCalled()
  })
})
