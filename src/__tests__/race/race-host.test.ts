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
 * The RENDERLESS race engine (C10, pace-caret era): when the run's data
 * arrives, the HOME game store is set up with the record's EXACT words (the
 * seed's regeneration — including a quote's fixed text), the config bar shows
 * the record's settings over a snapshot of the player's own, and everything
 * visible is published through the race store — the ghost's caret and name,
 * and (after the line) only a DEFEAT. There is no countdown and no chrome:
 * the player's first keystroke is the starting gun, and the pace selector's
 * `race.exit()` is the way out.
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
  it('sets the HOME game up with the record’s exact words and publishes the ghost through the store', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()

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

    // Everything visible is store state: the ghost seated on the start line,
    // named for the pace selector, no defeat yet — and the game waits, idle,
    // for the player's first keystroke (no countdown exists).
    expect(race.ghostCaret).toEqual({ label: 'Ada', wordIndex: 0, charIndex: 0 })
    expect(race.ghostName).toBe('Ada')
    expect(race.defeat).toBeNull()
    expect(game.phase).toBe('idle')

    wrapper.unmount()
  })

  it('the first keystroke is the starting gun — no countdown gates the run', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()
    sourceReplay.value = replayData
    sourceState.value = 'ready'
    await flushPromises()

    const game = useGameStore('local')
    expect(game.phase).toBe('idle')
    game.insert('a')
    expect(game.phase).toBe('running')

    wrapper.unmount()
  })

  it('re-seats the SAME ghost on the start line on a restart request', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()
    sourceReplay.value = replayData
    sourceState.value = 'ready'
    await flushPromises()

    race.requestRestart()
    await flushPromises()
    expect(race.ghostCaret).toEqual({ label: 'Ada', wordIndex: 0, charIndex: 0 })
    expect([...useGameStore('local').words]).toEqual(['ab', 'cd'])
    expect(useGameStore('local').phase).toBe('idle')

    wrapper.unmount()
  })

  it('exit (the pace selector’s job) restores the player’s settings through the store round-trip', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()
    sourceReplay.value = replayData
    sourceState.value = 'ready'
    await flushPromises()

    race.exit()
    expect(race.racing).toBe(false)
    // The ghost leaves the field and the selector with the race.
    expect(race.ghostCaret).toBeNull()
    expect(race.ghostName).toBeNull()
    expect(configState.mode).toBe('time')
    expect(configState.time).toBe(30)
    expect(configState.punctuation).toBe(false)

    wrapper.unmount()
  })

  it('a failed fetch exits the race instead of stranding a locked bar', async () => {
    const race = useRaceStore()
    race.request('run-ada')
    const wrapper = mountHost()

    sourceState.value = 'not-found'
    await flushPromises()

    expect(race.racing).toBe(false)
    expect(race.ghostCaret).toBeNull()

    wrapper.unmount()
  })
})
