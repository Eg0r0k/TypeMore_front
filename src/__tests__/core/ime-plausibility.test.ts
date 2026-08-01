/**
 * The honest IME path against the plausibility heuristics.
 *
 * A composition session dispatches ONE `replace` carrying a whole word, and
 * every character of it shares one timestamp — that is what a composed word IS,
 * a single act of input, not N keystrokes typed in zero milliseconds. Android
 * runs plain latin through composition, so this is not an exotic path: it is how
 * a large share of mobile players type. Flagging it would flag them.
 *
 * These tests pin the CURRENT behaviour rather than change anything. Every
 * interval heuristic reads `insert` events only, so a `replace` contributes no
 * interval at all — a property that is easy to lose the day somebody widens that
 * filter to "all text events" and cannot see who it costs.
 *
 * Lives here and not in `packages/core/tests` on purpose: this task does not
 * touch the core, and asserting core behaviour from the app keeps it that way.
 */
import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  EVENT_LOG_VERSION,
  commitEvent,
  dictVersion,
  generateWords,
  insertEvent,
  makeSeedContext,
  replaceEvent,
  validateLog
} from '@typemore/core'

/** Korean words, the shape an IME actually commits: whole syllables at once. */
const dict: Dictionary = {
  name: 'korean-test',
  bcp47: 'ko',
  words: ['한글', '입력', '하다', '있다', '되다', '보다', '주다', '가다']
}

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 6,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const coreCfg = (): CoreConfig => ({
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
})

const snap: ConfigSnapshot = { config: coreCfg(), generation: gen() }

const wordsFor = (seed: number): readonly string[] =>
  generateWords(dict, makeSeedContext(dict, seed, gen()))._unsafeUnwrap().words

const run = (seed: number, log: EventLog) =>
  validateLog({
    seed,
    dictionary: dict,
    dictVersion: dictVersion(dict.words),
    configSnapshot: snap,
    log
  })

const codesOf = (log: EventLog, seed = 1): string[] =>
  run(seed, log)._unsafeUnwrap().flags.map((flag) => flag.code)

/**
 * A run typed the way an IME commits: one `replace` per word, all of its
 * characters at one instant, then the separator.
 */
function composeAll(words: readonly string[], perWordMs = 420): EventLog {
  const events: GameEvent[] = []
  let seq = 1
  let t = 0
  for (const word of words) {
    events.push(replaceEvent(seq++, t, 0, 0, word, 'ime'))
    events.push(commitEvent(seq++, t))
    // Human-ish spread between words; within a word there is nothing to spread.
    t += perWordMs + (seq % 5) * 30
  }
  return { version: EVENT_LOG_VERSION, events }
}

describe('a composed run is valid', () => {
  it('folds to a finished run with the words it composed', () => {
    const words = wordsFor(1)
    const report = run(1, composeAll(words))._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    expect(report.metrics.accuracy).toBe(1)
  })
})

describe('interval heuristics ignore composed text', () => {
  it('does not flag min-interval for characters sharing one timestamp', () => {
    // Every word here is 2 characters at an identical `t`. Read as keystrokes
    // that would be six 0ms intervals — the most damning signal there is.
    expect(codesOf(composeAll(wordsFor(1)))).not.toContain('min-interval')
  })

  it('does not flag zero-variance or uniform-intervals', () => {
    const codes = codesOf(composeAll(wordsFor(2)), 2)
    expect(codes).not.toContain('zero-variance')
    expect(codes).not.toContain('uniform-intervals')
  })

  it('flags nothing at all for a plainly human composed run', () => {
    expect(codesOf(composeAll(wordsFor(3)), 3)).toEqual([])
  })

  it('still flags a bot that types characters at a fixed cadence', () => {
    // The control: the heuristics are not simply switched off for this corpus.
    const words = wordsFor(4)
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    for (const word of words) {
      for (const char of word) {
        events.push(insertEvent(seq++, t, char))
        t += 12 // inhumanly fast AND perfectly uniform
      }
      events.push(commitEvent(seq++, t))
    }
    const codes = codesOf({ version: EVENT_LOG_VERSION, events }, 4)
    expect(codes).toContain('min-interval')
  })
})

describe("'ime' is not 'paste'", () => {
  it('does not raise the paste flag', () => {
    expect(codesOf(composeAll(wordsFor(5)), 5)).not.toContain('paste')
  })

  it('raises it for a real paste of the same shape', () => {
    // Same events, one field different — which is the whole point of the field.
    const words = wordsFor(6)
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    for (const word of words) {
      events.push(replaceEvent(seq++, t, 0, 0, word, 'paste'))
      events.push(commitEvent(seq++, t))
      t += 420
    }
    expect(codesOf({ version: EVENT_LOG_VERSION, events }, 6)).toContain('paste')
  })
})

describe('multi-grapheme-insert stays about inserts', () => {
  it('is not raised by a composed word', () => {
    // The adapter never emits a multi-grapheme `insert`; composition goes
    // through `replace` precisely so this flag keeps meaning what it says.
    expect(codesOf(composeAll(wordsFor(7)), 7)).not.toContain('multi-grapheme-insert')
  })
})
