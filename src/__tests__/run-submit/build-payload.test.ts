import { describe, it, expect } from 'vitest'

import {
  EVENT_LOG_VERSION,
  insertEvent,
  type CoreConfig,
  type GenerationConfig,
  type Metrics,
  type ModsDeclaration,
  type ScoreResult
} from '@shared/core'
import {
  buildRunPayload,
  isRankedMode,
  SCORE_VERSION,
  type RunSubmitContext
} from '@/features/run-submit/model/build-payload'

// A representative finished-run context. Mirrors the RUNS.md example body so the
// snapshot below is a direct contract check against the documented payload.
const config: CoreConfig = {
  mode: 'time',
  durationMs: 15000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}

const generation: GenerationConfig = {
  mode: 'time',
  length: 15,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}

const declaration: ModsDeclaration = { blind: false, fading: false, flashlight: false }

const metrics: Metrics = {
  wpm: 80,
  raw: 85,
  accuracy: 0.97,
  consistency: 72,
  chars: { correct: 200, incorrect: 6, extra: 0, missed: 0 },
  spaces: 40,
  durationSec: 15
}

const score: ScoreResult = {
  version: 2,
  total: 1234,
  base: 1300,
  comboPeak: 50,
  accMultiplier: 0.94,
  timeBonus: null,
  modMultiplier: 1
}

const log = [insertEvent(1, 12, 't')]

const timeCtx = (): RunSubmitContext => ({
  mode: 'time',
  config,
  generation,
  declaration,
  lang: 'en',
  seed: 2864901,
  dictHash: 'a1b2c3d4',
  metrics,
  score,
  log
})

describe('isRankedMode — seeded, ranked-eligible modes only', () => {
  it('accepts time and words, rejects free/custom/quote', () => {
    expect(isRankedMode('time')).toBe(true)
    expect(isRankedMode('words')).toBe(true)
    expect(isRankedMode('free')).toBe(false)
    expect(isRankedMode('custom')).toBe(false)
    expect(isRankedMode('quote')).toBe(false)
  })
})

describe('buildRunPayload — RUNS.md field-for-field (contract-drift guard)', () => {
  it('maps every documented field for a time-mode run', () => {
    const payload = buildRunPayload(timeCtx())

    // Exact top-level key set — a new/removed field trips this guard.
    expect(Object.keys(payload).sort()).toEqual(
      [
        'clientMetrics',
        'clientScore',
        'dictHash',
        'durationMs',
        'lang',
        'log',
        'mode',
        'scoreVersion',
        'seed',
        'setup'
      ].sort()
    )

    expect(payload.mode).toBe('time')
    expect(payload.durationMs).toBe(15000)
    // Exactly one dimension: time carries durationMs, never wordCount.
    expect('wordCount' in payload).toBe(false)
    expect(payload.lang).toBe('en')
    expect(payload.seed).toBe(2864901)
    expect(payload.dictHash).toBe('a1b2c3d4')
    expect(payload.scoreVersion).toBe(SCORE_VERSION)
    expect(payload.scoreVersion).toBe(2)

    // toEqual verifies the exact setup shape ({config, generation, declaration}) — no extra keys.
    expect(payload.setup).toEqual({ config, generation, declaration })

    expect(payload.clientMetrics).toEqual({ wpm: 80, raw: 85, acc: 0.97 })
    expect(payload.clientScore).toEqual(score)

    // RUNS.md: log.version must equal 1. The payload wraps events in the core EventLog.
    expect(EVENT_LOG_VERSION).toBe(1)
    expect(payload.log).toEqual({ version: 1, events: log })
  })

  it('carries wordCount (never durationMs) for a words-mode run', () => {
    const payload = buildRunPayload({
      ...timeCtx(),
      mode: 'words',
      config: { ...config, mode: 'words' },
      generation: { ...generation, mode: 'words', length: 25 }
    })

    expect(payload.mode).toBe('words')
    expect(payload.wordCount).toBe(25)
    expect('durationMs' in payload).toBe(false)
    expect(Object.keys(payload).sort()).toEqual(
      [
        'clientMetrics',
        'clientScore',
        'dictHash',
        'lang',
        'log',
        'mode',
        'scoreVersion',
        'seed',
        'setup',
        'wordCount'
      ].sort()
    )
  })
})
