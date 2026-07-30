import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type CoreConfig,
  type GameEvent,
  EVENT_LOG_VERSION,
  EVENT_LOG_VERSION_TELEMETRY,
  insertEvent,
  isTelemetryEvent,
  keyDownEvent
} from '@typemore/core'
import { detectLogVersion } from '@shared/lib/log-version'
import { releaseGameStore, useGameStore } from '@entities/game'
import { EventBatcher } from '@shared/match-transport'
import type { ClientCommand, MatchTransport } from '@shared/match-transport'

const wordsConfig: CoreConfig = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

const kinds = (events: readonly GameEvent[]): readonly string[] => events.map((e) => e.kind)

describe('game store telemetry capture (log v2)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => releaseGameStore('cap'))

  it('records down before the insert and up after it, through the same seq stream', () => {
    const store = useGameStore('cap')
    store.setup({
      config: wordsConfig,
      words: ['ab'],
      logVersion: EVENT_LOG_VERSION_TELEMETRY
    })
    store.keyDown('KeyA')
    store.insert('a')
    store.keyUp('KeyA')
    store.keyDown('KeyB')
    store.insert('b')

    const log = store.getReplayData()?.log ?? []
    expect(kinds(log)).toEqual(['down', 'insert', 'up', 'down', 'insert'])
    expect(log.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5])
    expect(store.logVersion).toBe(EVENT_LOG_VERSION_TELEMETRY)
  })

  it('capture stops with the run: the final release is not logged', () => {
    const store = useGameStore('cap')
    store.setup({
      config: wordsConfig,
      words: ['a'],
      logVersion: EVENT_LOG_VERSION_TELEMETRY
    })
    store.keyDown('KeyA')
    store.insert('a')
    store.keyDown('Space')
    store.commit() // committing the last word finishes the count-mode run
    expect(store.phase).toBe('finished')
    store.keyUp('Space')
    store.keyUp('KeyA')
    const log = store.getReplayData()?.log ?? []
    expect(kinds(log)).toEqual(['down', 'insert', 'down', 'commit'])
  })

  it('a v1 run drops telemetry entirely (and stays seq-contiguous)', () => {
    const store = useGameStore('cap')
    store.setup({ config: wordsConfig, words: ['ab'], logVersion: EVENT_LOG_VERSION })
    store.keyDown('KeyA')
    store.insert('a')
    store.keyUp('KeyA')
    const log = store.getReplayData()?.log ?? []
    expect(log.some(isTelemetryEvent)).toBe(false)
    expect(log.map((e) => e.seq)).toEqual([1])
  })

  it('setup without an injected version follows capability detection', () => {
    // Make detection answer "no physical keyboard" and check the run lands on
    // v1 — the store consults detectLogVersion at setup, not at capture time.
    vi.stubGlobal('matchMedia', undefined)
    try {
      const store = useGameStore('cap')
      store.setup({ config: wordsConfig, words: ['ab'] })
      expect(store.logVersion).toBe(EVENT_LOG_VERSION)
      store.keyDown('KeyA')
      store.insert('a')
      const log = store.getReplayData()?.log ?? []
      expect(log.some(isTelemetryEvent)).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('the telemetry-bearing run still folds and scores like its v1 twin', () => {
    const store = useGameStore('cap')
    store.setup({
      config: wordsConfig,
      words: ['ab'],
      logVersion: EVENT_LOG_VERSION_TELEMETRY
    })
    store.keyDown('KeyA')
    store.insert('a')
    store.keyUp('KeyA')
    expect(store.wordIndex).toBe(0)
    expect(store.snapshot.input[0]).toBe('a')
    // Metrics come from the state events alone — one correct keypress.
    expect(store.metrics.accuracy).toBe(1)
  })
})

describe('detectLogVersion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is conservative: no matchMedia ⇒ v1', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(detectLogVersion()).toBe(EVENT_LOG_VERSION)
  })

  it('is conservative: a DOM that matches every media query ⇒ v1', () => {
    // A stub environment answering "yes" to both fine AND coarse pointers
    // contradicts itself — an incoherent answer must never enable capture.
    vi.stubGlobal('navigator', { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(detectLogVersion()).toBe(EVENT_LOG_VERSION)
  })

  it('touch points ⇒ v1 even with a fine pointer', () => {
    vi.stubGlobal('navigator', { maxTouchPoints: 2, userAgent: 'Mozilla/5.0' })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(detectLogVersion()).toBe(EVENT_LOG_VERSION)
  })

  it('mobile user agent ⇒ v1', () => {
    vi.stubGlobal('navigator', {
      maxTouchPoints: 0,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    })
    expect(detectLogVersion()).toBe(EVENT_LOG_VERSION)
  })

  it('desktop with a fine pointer and no touch ⇒ v2', () => {
    vi.stubGlobal('navigator', { maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })
    vi.stubGlobal('matchMedia', (query: string): { matches: boolean } => ({
      matches: query === '(pointer: fine)'
    }))
    expect(detectLogVersion()).toBe(EVENT_LOG_VERSION_TELEMETRY)
  })
})

describe('EventBatcher and the run version', () => {
  function fakeTransport(): { transport: MatchTransport; sent: ClientCommand[] } {
    const sent: ClientCommand[] = []
    const transport: MatchTransport = {
      state: 'in_match',
      playerId: 'p1',
      resumeToken: null,
      connect: () => Promise.resolve(),
      disconnect: () => {},
      send: (frame) => {
        sent.push(frame)
      },
      onEvent: () => () => {},
      onState: () => () => {}
    }
    return { transport, sent }
  }

  it('stamps event_batch.version with the run version it was armed with', () => {
    const { transport, sent } = fakeTransport()
    const batcher = new EventBatcher({ transport })
    batcher.startMatch('m1', EVENT_LOG_VERSION_TELEMETRY)
    batcher.push(keyDownEvent(1, 0, 'KeyA'))
    batcher.flush()
    expect(sent).toHaveLength(1)
    expect((sent[0] as { version: number }).version).toBe(2)
    batcher.dispose()
  })

  it('defaults to v1 when armed without a version', () => {
    const { transport, sent } = fakeTransport()
    const batcher = new EventBatcher({ transport })
    batcher.startMatch('m1')
    batcher.push(insertEvent(1, 0, 'a'))
    batcher.flush()
    expect((sent[0] as { version: number }).version).toBe(1)
    batcher.dispose()
  })
})
