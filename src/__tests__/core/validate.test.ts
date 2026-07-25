import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  type PlausibilityThresholds,
  EVENT_LOG_VERSION,
  GameCore,
  commitEvent,
  deleteEvent,
  dictVersion,
  generateWords,
  insertEvent,
  makeSeedContext,
  validateLog
} from '@shared/core'

const dict: Dictionary = {
  name: 'test',
  bcp47: 'en',
  words: [
    'alpha',
    'bravo',
    'charlie',
    'delta',
    'echo',
    'foxtrot',
    'golf',
    'hotel',
    'india',
    'juliet'
  ]
}

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 5,
  punctuation: false,
  numbers: false,
  randomCase: false,
  ...over
})

const coreCfg = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 60_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const snapshot = (
  coreOver: Partial<CoreConfig> = {},
  genOver: Partial<GenerationConfig> = {}
): ConfigSnapshot => ({
  config: coreCfg(coreOver),
  generation: gen(genOver)
})

const wordsFor = (seed: number, genOver: Partial<GenerationConfig> = {}): readonly string[] =>
  generateWords(dict, makeSeedContext(dict, seed, gen(genOver)))._unsafeUnwrap().words

const run = (
  seed: number,
  log: EventLog,
  snap: ConfigSnapshot = snapshot(),
  thresholds?: Partial<PlausibilityThresholds>
) =>
  validateLog({
    seed,
    dictionary: dict,
    dictVersion: dictVersion(dict.words),
    configSnapshot: snap,
    log,
    thresholds
  })

/** Type every word correctly. `intervalMs` fixed = bot cadence; jitter = human. */
function typeAll(
  words: readonly string[],
  opts: { nospace?: boolean; fixedInterval?: number } = {}
): EventLog {
  const events: GameEvent[] = []
  let seq = 1
  let t = 0
  const advance = (i: number) => {
    t += opts.fixedInterval ?? 80 + (i % 6) * 12
  }
  for (let w = 0; w < words.length; w++) {
    for (const ch of words[w]) {
      events.push(insertEvent(seq++, t, ch))
      advance(seq)
    }
    // Commit shares the current instant (no extra advance), so consecutive INSERT
    // intervals stay uniform under a fixed cadence.
    if (!opts.nospace) events.push(commitEvent(seq++, t))
  }
  return { version: EVENT_LOG_VERSION, events }
}

describe('validateLog', () => {
  it('accepts a valid human log and recomputes metrics from it', () => {
    const words = wordsFor(1)
    const report = run(1, typeAll(words))._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    expect(report.metrics.accuracy).toBe(1)
    expect(report.metrics.wpm).toBeGreaterThan(0)
    expect(report.flags.map((f) => f.code)).not.toContain('uniform-intervals')
    expect(report.flags.map((f) => f.code)).not.toContain('min-interval')
  })

  it('rejects a time teleport (event past the timed deadline)', () => {
    const words = wordsFor(2, { mode: 'time', length: 5 })
    const events: GameEvent[] = [
      insertEvent(1, 0, words[0][0]),
      insertEvent(2, 100, words[0][1]),
      insertEvent(3, 99_999, words[0][2]) // teleport far past the 5s deadline
    ]
    const report = run(
      2,
      { version: EVENT_LOG_VERSION, events },
      snapshot({ mode: 'time', durationMs: 5000 }, { mode: 'time', length: 5 })
    )._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/deadline/)
  })

  it('rejects a gap in the seq numbering', () => {
    const words = wordsFor(1)
    const good = typeAll(words).events.slice()
    // drop the 3rd event -> seq becomes 1,2,4,5,...
    const events = [...good.slice(0, 2), ...good.slice(3)]
    const report = run(1, { version: EVENT_LOG_VERSION, events })._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/seq/)
  })

  it('flags a perfect bot (uniform, zero-variance cadence) but still replays', () => {
    const words = wordsFor(1)
    const report = run(1, typeAll(words, { fixedInterval: 60 }))._unsafeUnwrap()
    const codes = report.flags.map((f) => f.code)
    expect(codes).toContain('uniform-intervals')
    expect(codes).toContain('zero-variance')
  })

  it('accepts a nospace log with no commit events', () => {
    const words = wordsFor(3)
    const report = run(
      3,
      typeAll(words, { nospace: true }),
      snapshot({ nospace: true })
    )._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
  })

  it('rejects a nospace log that contains commit events', () => {
    const words = wordsFor(3)
    const report = run(3, typeAll(words), snapshot({ nospace: true }))._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/nospace/)
  })

  /**
   * The client-side guarantee behind the two cases above: a real session drives
   * the SAME reducer, which refuses a commit under nospace, so a player who
   * habitually taps space still submits a commit-free log.
   */
  it('accepts a nospace run whose player kept pressing space', () => {
    const words = wordsFor(3)
    const core = new GameCore({ config: coreCfg({ nospace: true }), words })
    let seq = 1
    let t = 0
    for (const word of words) {
      for (const ch of word) core.dispatch(insertEvent(seq++, (t += 80), ch))
      // The habitual separator press: refused by the reducer, so the seq it
      // borrowed is handed straight back (what the store does) and the log the
      // player submits is contiguous AND commit-free.
      core.dispatch(commitEvent(seq, (t += 80)))
    }

    expect(core.events.some((event) => event.kind === 'commit')).toBe(false)

    const report = run(
      3,
      { version: EVENT_LOG_VERSION, events: core.events },
      snapshot({ nospace: true })
    )._unsafeUnwrap()

    expect(report.verdict).toBe('valid')
    expect(report.metrics.accuracy).toBe(1)
  })

  it('rejects a backspace into a correctly-committed word', () => {
    const words = wordsFor(1)
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    for (const ch of words[0]) {
      events.push(insertEvent(seq++, t, ch))
      t += 80
    }
    events.push(commitEvent(seq++, t)) // word 0 committed fully correct
    t += 80
    events.push(deleteEvent(seq++, t, 'char')) // boundary backspace into correct word 0
    const report = run(1, { version: EVENT_LOG_VERSION, events })._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/BackspaceLocked/)
  })

  it('rejects a master log with events after the first wrong keystroke', () => {
    const words = wordsFor(1)
    const target = words[0]
    const wrong = target[1] === 'x' ? 'y' : 'x'
    const events: GameEvent[] = [
      insertEvent(1, 0, target[0]), // correct
      insertEvent(2, 80, wrong), // wrong -> master fail (finished)
      insertEvent(3, 160, target[0]) // event after finished -> invalid
    ]
    const report = run(
      1,
      { version: EVENT_LOG_VERSION, events },
      snapshot({ difficulty: 'master' })
    )._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
  })

  it('flags a multi-grapheme insert without invalidating the log', () => {
    const words = wordsFor(1)
    const events: GameEvent[] = []
    let seq = 1
    let t = 0
    // First word: two graphemes in a single insert, then the rest singly.
    events.push(insertEvent(seq++, t, words[0].slice(0, 2)))
    t += 80
    for (const ch of words[0].slice(2)) {
      events.push(insertEvent(seq++, t, ch))
      t += 80
    }
    events.push(commitEvent(seq++, t))
    t += 80
    for (let w = 1; w < words.length; w++) {
      for (const ch of words[w]) {
        events.push(insertEvent(seq++, t, ch))
        t += 80
      }
      events.push(commitEvent(seq++, t))
      t += 80
    }
    const report = run(1, { version: EVENT_LOG_VERSION, events })._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    expect(report.flags.map((f) => f.code)).toContain('multi-grapheme-insert')
  })

  it('errors when the dictionary version drifts from the claim', () => {
    const words = wordsFor(1)
    const res = validateLog({
      seed: 1,
      dictionary: dict,
      dictVersion: 'deadbeef', // wrong claimed version
      configSnapshot: snapshot(),
      log: typeAll(words)
    })
    expect(res.isErr()).toBe(true)
    expect(res._unsafeUnwrapErr().kind).toBe('DictVersionMismatch')
  })
})

describe('validateLog — AFK flags (scored, never a verdict)', () => {
  // Word 0's characters over a 10 s window with keystrokes only in buckets 1, 6
  // and 10 → 7 idle seconds out of 10 = a 0.7 idle share.
  const idleWord = wordsFor(1)[0]
  const idleShareLog: EventLog = {
    version: EVENT_LOG_VERSION,
    events: [0, 500, 6000, 9500, 10_000].map((t, i) => insertEvent(i + 1, t, idleWord[i] ?? 'x'))
  }

  it('flags afk-heavy when the idle share reaches afkFlagShare exactly', () => {
    const report = run(1, idleShareLog, snapshot(), { afkFlagShare: 0.7 })._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    const afk = report.flags.find((f) => f.code === 'afk-heavy')
    expect(afk?.score).toBeCloseTo(0.7, 10)
  })

  it('leaves afk-heavy unflagged when the idle share is below afkFlagShare', () => {
    const report = run(1, idleShareLog, snapshot(), { afkFlagShare: 0.71 })._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    expect(report.flags.map((f) => f.code)).not.toContain('afk-heavy')
  })

  // Timed run: the window is pinned to the 30 s deadline, so quitting at 2 s
  // leaves a 28 s tail after the last keystroke.
  const timedGen = { mode: 'time' as const, length: 5 }
  const timedSnap = snapshot({ mode: 'time', durationMs: 30_000 }, timedGen)
  const tailWord = wordsFor(4, timedGen)[0]
  const tailLog: EventLog = {
    version: EVENT_LOG_VERSION,
    events: [0, 480, 1010, 1490, 2000].map((t, i) => insertEvent(i + 1, t, tailWord[i] ?? 'x'))
  }

  it('flags trailing-afk for an idle tail at/above trailingAfkMs', () => {
    const report = run(4, tailLog, timedSnap, { trailingAfkMs: 28_000 })._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
    expect(report.flags.map((f) => f.code)).toContain('trailing-afk')
  })

  it('leaves trailing-afk unflagged when the tail is shorter than trailingAfkMs', () => {
    const report = run(4, tailLog, timedSnap, { trailingAfkMs: 28_001 })._unsafeUnwrap()
    expect(report.flags.map((f) => f.code)).not.toContain('trailing-afk')
  })
})

describe('validateLog — start policy anchors the two-clock check', () => {
  const timedGen = { mode: 'time' as const, length: 5 }
  // First event at 5 s, last at 12 s: past a go-anchored 10 s deadline, inside a
  // lazily-anchored one (5 s + 10 s).
  const lateWord = wordsFor(5, timedGen)[0]
  const lateLog: EventLog = {
    version: EVENT_LOG_VERSION,
    events: [5000, 9000, 12_000].map((t, i) => insertEvent(i + 1, t, lateWord[i] ?? 'x'))
  }

  it("a 'go' log is judged against durationMs from t = 0 (a later event is a time teleport)", () => {
    const snap = snapshot({ mode: 'time', durationMs: 10_000, startPolicy: 'go' }, timedGen)
    const report = run(5, lateLog, snap)._unsafeUnwrap()
    expect(report.verdict).toBe('invalid')
    expect(report.reason).toMatch(/deadline 10000/)
  })

  it('the same log is valid under the default policy, whose zero point is its first event', () => {
    const snap = snapshot({ mode: 'time', durationMs: 10_000 }, timedGen)
    const report = run(5, lateLog, snap)._unsafeUnwrap()
    expect(report.verdict).toBe('valid')
  })
})
