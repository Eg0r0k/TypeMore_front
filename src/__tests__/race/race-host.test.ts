import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ReplayData } from '@entities/game'
import { releaseGameStore, useGameStore } from '@entities/game'
import { useRaceStore } from '@entities/race'
import { RaceHost } from '@/features/test/race'
import { configState, setConfig } from '@/shared/lib/helpers/config'
import {
  type CoreConfig,
  type GameEvent,
  DEFAULT_MAX_EXTRA_CHARS,
  SCORE_VERSION_2,
  commitEvent,
  insertEvent
} from '@shared/core'
import en from '@/app/i18n/locales/en'

/**
 * The race host's setup-application fidelity (C10): when the run's data
 * arrives, the HOME game store is set up with the record's EXACT words (the
 * seed's regeneration — including a quote's fixed text), the config bar shows
 * the record's settings over a snapshot of the player's own, and a restart
 * re-races the same ghost from a fresh 3-2-1.
 */

const sourceState = ref<'loading' | 'not-found' | 'error' | 'ready'>('loading')
const sourceReplay = ref<ReplayData | null>(null)

vi.mock('@/features/replay-view', () => ({
  useReplaySource: () => ({
    state: computed(() => sourceState.value),
    replay: computed(() => sourceReplay.value),
    displayName: computed(() => 'Ada'),
    retry: vi.fn()
  })
}))

const config: CoreConfig = {
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

const quoteSource = {
  kind: 'quote',
  quoteId: '3f2a1b0c-9d8e-4c7b-8a6f-5e4d3c2b1a09',
  quoteHash: 'e42437c7',
  text: 'ab cd'
} as const

const replayData: ReplayData = {
  config,
  words: ['ab', 'cd'],
  log: [
    insertEvent(1, 0, 'a'),
    insertEvent(2, 100, 'b'),
    commitEvent(3, 200),
    insertEvent(4, 300, 'c'),
    insertEvent(5, 400, 'd'),
    commitEvent(6, 500)
  ] as GameEvent[],
  generation: {
    mode: 'words',
    length: 2,
    punctuation: true,
    numbers: false,
    randomCase: false,
    reverse: false,
    textSource: quoteSource
  },
  declaration: { blind: false, fading: false, flashlight: false },
  score: { version: SCORE_VERSION_2, total: 123 } as ReplayData['score'],
  grade: 'S'
}

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const mountHost = () =>
  mount(RaceHost, {
    props: { runId: 'run-ada' },
    global: { plugins: [i18n] }
  })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  sourceState.value = 'loading'
  sourceReplay.value = null
  setConfig('mode', 'time')
  setConfig('time', 30)
  setConfig('punctuation', false)
})

afterEach(() => {
  vi.useRealTimers()
  releaseGameStore('local')
})

describe('RaceHost — setup application fidelity', () => {
  it('sets the HOME game up with the record’s exact words, quote included, and shows the banner', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()

    expect(wrapper.find('[data-testid="race-loading"]').exists()).toBe(true)

    sourceReplay.value = replayData
    sourceState.value = 'ready'
    await flushPromises()

    // The record's setup, wholesale: the exact word list (a quote's fixed
    // text travels inside it) and the record's generation snapshot.
    const game = useGameStore('local')
    expect([...game.words]).toEqual(['ab', 'cd'])
    const data = game.getReplayData()
    expect(data?.generation.textSource).toEqual(quoteSource)

    // The bar now shows the record: words mode, punctuation on…
    expect(configState.mode).toBe('words')
    expect(configState.words).toBe(2)
    expect(configState.punctuation).toBe(true)
    // …and the player's own settings are safe in the snapshot.
    expect(race.snapshot?.mode).toBe('time')
    expect(race.snapshot?.time).toBe(30)

    expect(wrapper.find('[data-testid="race-banner"]').text()).toContain('Ada')
    expect(wrapper.find('[data-testid="race-banner"]').text()).toContain('123')
    expect(wrapper.find('[data-testid="race-countdown"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('re-races the SAME ghost from 3-2-1 on a restart request', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()
    sourceReplay.value = replayData
    sourceState.value = 'ready'
    await flushPromises()

    // Let the countdown finish: the overlay leaves.
    await vi.advanceTimersByTimeAsync(3200)
    expect(wrapper.find('[data-testid="race-countdown"]').exists()).toBe(false)

    // A restart brings the countdown back over the same record.
    race.requestRestart()
    await flushPromises()
    expect(wrapper.find('[data-testid="race-countdown"]').exists()).toBe(true)
    expect([...useGameStore('local').words]).toEqual(['ab', 'cd'])

    wrapper.unmount()
  })

  it('exit restores the player’s settings through the store round-trip', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()
    sourceReplay.value = replayData
    sourceState.value = 'ready'
    await flushPromises()

    await wrapper.find('[data-testid="race-exit"]').trigger('click')
    expect(race.racing).toBe(false)
    expect(configState.mode).toBe('time')
    expect(configState.time).toBe(30)
    expect(configState.punctuation).toBe(false)

    wrapper.unmount()
  })
})
