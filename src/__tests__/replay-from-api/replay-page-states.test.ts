/**
 * `/replay/:runId` renders THREE requests, and the point of the page is that
 * their failures never collapse into one another. A spectator who is told "that
 * run is not available" when the run loaded fine and only its keystrokes failed
 * has been lied to — and offered a back link where a retry would have worked.
 * These tests defend that separation and the per-query retry that follows from
 * it; the copy itself lives in the locale files and is not restated here.
 */
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// No network, no router, no real player: the page's own state machine is the
// system under test.
const { metaFn, logFn, dictFn, quoteFn, pushMock } = vi.hoisted(() => ({
  metaFn: vi.fn(),
  logFn: vi.fn(),
  dictFn: vi.fn(),
  quoteFn: vi.fn(),
  pushMock: vi.fn()
}))

vi.mock('@shared/api', () => ({
  runReplayQueryOptions: (id: string) => ({ queryKey: ['run-replay', id], queryFn: metaFn }),
  runReplayLogQueryOptions: (id: string) => ({ queryKey: ['run-replay-log', id], queryFn: logFn }),
  dictionaryBodyByHashQueryOptions: (hash: string) => ({
    queryKey: ['dict-by-hash', hash],
    queryFn: dictFn
  }),
  // Stage 3 has two endpoints now — a seeded run's word list by content hash,
  // a quote run's text by id. These specs drive the seeded path, so this one is
  // never enabled; it must exist all the same, or the page throws on an
  // undefined import before any state can render.
  quoteByIdQueryOptions: (id: string) => ({
    queryKey: ['quote-by-id', id],
    queryFn: quoteFn
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { bucket: 'time-15000-en-US' } }),
  useRouter: () => ({ push: pushMock })
}))

vi.mock('@/features/test/replay', () => ({
  ReplayPlayer: defineComponent({
    name: 'ReplayPlayer',
    props: { replay: { type: Object, required: true }, isRightToLeft: Boolean },
    emits: ['exit'],
    setup: () => () => h('div', { 'data-testid': 'replay-player' })
  })
}))

import { dictVersion, insertEvent, type CoreConfig, type GenerationConfig } from '@shared/core'
import { i18n } from '@app/i18n'
import { TooltipProvider } from '@/shared/ui/tooltip'
import ReplayPage from '@/pages/replay/ui.vue'

const WORDS = ['alpha', 'bravo', 'charlie', 'delta']
const DICT_HASH = dictVersion(WORDS)

const config: CoreConfig = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

const generation: GenerationConfig = {
  mode: 'words',
  length: 4,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}

const META = {
  runId: 'run-1',
  displayName: 'boardsmoke',
  mode: 'words',
  wordCount: 4,
  lang: 'en-US',
  seed: 7,
  dictHash: DICT_HASH,
  setup: { config, generation, declaration: { blind: false, fading: false, flashlight: false } },
  serverMetrics: {},
  serverScore: {
    version: 2,
    total: 900,
    base: 800,
    comboPeak: 4,
    accMultiplier: 1,
    timeBonus: null
  },
  grade: 'SS',
  achievedAt: '2026-07-25T13:43:14.772724Z'
}

const LOG = { version: 1, events: [insertEvent(1, 10, 'a')] }
const DICT = { name: 'english', words: WORDS, bcp47: 'en-US', rightToleft: false }

const mountPage = (): VueWrapper => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  // Under a TooltipProvider + pinia: the ready state renders the REAL results
  // screen (tooltipped icon actions, screenshot side effect), not a stub.
  return mount(TooltipProvider, {
    global: { plugins: [i18n, createPinia(), [VueQueryPlugin, { queryClient }]] },
    slots: { default: () => h(ReplayPage, { runId: 'run-1' }) }
  })
}

/** Let the metadata query settle, then the two it gates, then the render. */
const settle = async (wrapper: VueWrapper): Promise<void> => {
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await nextTick()
  }
  await wrapper.vm.$nextTick()
}

const seen = (wrapper: VueWrapper, id: string): boolean =>
  wrapper.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  metaFn.mockReset()
  logFn.mockReset()
  dictFn.mockReset()
  pushMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('/replay/:runId — failures stay apart', () => {
  it('a failing LOG with a succeeded metadata renders log-error, never not-found', async () => {
    metaFn.mockResolvedValue(META)
    logFn.mockRejectedValue(new Error('502'))
    dictFn.mockResolvedValue(DICT)

    const wrapper = mountPage()
    await settle(wrapper)

    expect(seen(wrapper, 'replay-log-error')).toBe(true)
    expect(seen(wrapper, 'replay-not-found')).toBe(false)
    expect(seen(wrapper, 'replay-player')).toBe(false)
    // The metadata is on screen: the viewer still learns whose run this is.
    expect(wrapper.find('[data-testid="replay-log-error"]').text()).toContain('boardsmoke')
    // Retryable, unlike a 404.
    expect(seen(wrapper, 'replay-log-retry')).toBe(true)
  })

  it('a failing METADATA renders not-found with a back link and no retry', async () => {
    metaFn.mockRejectedValue(new Error('404'))

    const wrapper = mountPage()
    await settle(wrapper)

    expect(seen(wrapper, 'replay-not-found')).toBe(true)
    expect(seen(wrapper, 'replay-log-error')).toBe(false)
    expect(seen(wrapper, 'replay-log-retry')).toBe(false)
    expect(seen(wrapper, 'replay-back')).toBe(true)
    // Stage 2 and 3 are gated on stage 1 SUCCEEDING — the replay pair shares one
    // rate-limit bucket, so a known-dead run must not spend a second token.
    expect(logFn).not.toHaveBeenCalled()
    expect(dictFn).not.toHaveBeenCalled()
  })

  it('a failing DICTIONARY is its own state, not a log failure', async () => {
    metaFn.mockResolvedValue(META)
    logFn.mockResolvedValue(LOG)
    dictFn.mockRejectedValue(new Error('404'))

    const wrapper = mountPage()
    await settle(wrapper)

    expect(seen(wrapper, 'replay-dict-error')).toBe(true)
    expect(seen(wrapper, 'replay-log-error')).toBe(false)
    expect(seen(wrapper, 'replay-not-found')).toBe(false)
  })

  it('a dictionary that does not hash to the run’s dictHash renders mismatch, with no retry', async () => {
    metaFn.mockResolvedValue(META)
    logFn.mockResolvedValue(LOG)
    dictFn.mockResolvedValue({ ...DICT, words: [...WORDS, 'echo'] })

    const wrapper = mountPage()
    await settle(wrapper)

    expect(seen(wrapper, 'replay-dict-mismatch')).toBe(true)
    expect(seen(wrapper, 'replay-build-error')).toBe(false)
    expect(seen(wrapper, 'replay-log-retry')).toBe(false)
    expect(seen(wrapper, 'replay-dict-retry')).toBe(false)
  })

  it('an unusable setup renders build-error, distinct from the mismatch', async () => {
    metaFn.mockResolvedValue({ ...META, setup: { config } })
    logFn.mockResolvedValue(LOG)
    dictFn.mockResolvedValue(DICT)

    const wrapper = mountPage()
    await settle(wrapper)

    expect(seen(wrapper, 'replay-build-error')).toBe(true)
    expect(seen(wrapper, 'replay-dict-mismatch')).toBe(false)
  })

  it('all three landing renders the run RESULTS, with playback one action away', async () => {
    metaFn.mockResolvedValue(META)
    logFn.mockResolvedValue(LOG)
    dictFn.mockResolvedValue(DICT)

    const wrapper = mountPage()
    await settle(wrapper)

    // The landing state is the results screen, not the player.
    expect(seen(wrapper, 'replay-results')).toBe(true)
    expect(seen(wrapper, 'replay-player')).toBe(false)
    expect(seen(wrapper, 'replay-loading')).toBe(false)
    expect(seen(wrapper, 'replay-log-loading')).toBe(false)
    expect(seen(wrapper, 'replay-build-error')).toBe(false)
    // Whose run it is, on screen.
    expect(wrapper.find('[data-testid="replay-results"]').text()).toContain('boardsmoke')

    // The results screen's replay action opens the player; its exit returns.
    await wrapper.find('[data-testid="results-replay"]').trigger('click')
    await nextTick()
    expect(seen(wrapper, 'replay-player')).toBe(true)
    expect(seen(wrapper, 'replay-results')).toBe(false)

    wrapper.findComponent({ name: 'ReplayPlayer' }).vm.$emit('exit')
    await nextTick()
    expect(seen(wrapper, 'replay-results')).toBe(true)
    expect(seen(wrapper, 'replay-player')).toBe(false)
  })
})

describe('/replay/:runId — recovery is scoped to the query that failed', () => {
  it('the log retry refetches only the log, and the page recovers', async () => {
    metaFn.mockResolvedValue(META)
    logFn.mockRejectedValueOnce(new Error('502')).mockResolvedValue(LOG)
    dictFn.mockResolvedValue(DICT)

    const wrapper = mountPage()
    await settle(wrapper)
    expect(seen(wrapper, 'replay-log-error')).toBe(true)

    const metaCalls = metaFn.mock.calls.length
    const dictCalls = dictFn.mock.calls.length
    await wrapper.find('[data-testid="replay-log-retry"]').trigger('click')
    await settle(wrapper)

    expect(seen(wrapper, 'replay-results')).toBe(true)
    expect(metaFn.mock.calls.length).toBe(metaCalls)
    expect(dictFn.mock.calls.length).toBe(dictCalls)
  })

  it('back carries the bucket the viewer came from', async () => {
    metaFn.mockRejectedValue(new Error('404'))

    const wrapper = mountPage()
    await settle(wrapper)
    await wrapper.find('[data-testid="replay-back"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({
      name: 'boards',
      query: { bucket: 'time-15000-en-US' }
    })
  })
})
