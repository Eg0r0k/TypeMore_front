// @vitest-environment node
//
// The canary DETECTORS in validateLog (validate.ts §9), driven end-to-end:
// synthetic logs are produced by replaying the INPUT ADAPTER's semantics
// (ui.vue: isSpaceGrapheme → separate-or-type, normalizeGrapheme before every
// insert) against a real GameCore, so what reaches validateLog is exactly what
// a client would have logged — accepted events only, contiguous seq.
//
// The contract under test, in order of importance:
// 1. DISARMED IS BIT-IDENTICAL. `canariesArmed` absent/false must change
//    nothing — not a flag, not an order, not a metric. Every stored run and
//    golden vector predates the canary deploy and is judged by this path.
// 2. A scraper feeding the rendered text back gets BOTH flags.
// 3. An honest player — across languages, freedom mode, backspaces, even
//    sloppy double-spaces — gets NEITHER, at any armed setting.
import { describe, expect, it } from 'vitest'

import {
  CANARY_CODEPOINTS,
  CANARY_SOFT,
  type Canary,
  type CoreConfig,
  type Dictionary,
  EVENT_LOG_VERSION,
  type EventLog,
  type GenerationConfig,
  GameCore,
  type ValidateLogInput,
  type ValidationReport,
  bufferOf,
  canaryAt,
  commitEvent,
  deleteEvent,
  dictVersion,
  generateWords,
  insertEvent,
  isSpaceGrapheme,
  makeSeedContext,
  normalizeGrapheme,
  validateLog
} from '@typemore/core'

// ── Adapter-semantics driver ────────────────────────────────────────────────

const config = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 60,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

/**
 * Drives a GameCore the way the hidden textarea does: seq is assigned on
 * ACCEPTANCE only (a rejected event's seq is reused, so the log stays
 * contiguous), t advances with a varied human-ish cadence, and every keystroke
 * goes through the adapter's exact space/normalize routing.
 */
class AdapterDriver {
  readonly core: GameCore
  private t = 0
  private k = 0

  constructor(cfg: CoreConfig, words: readonly string[]) {
    this.core = new GameCore({ config: cfg, words })
  }

  private stamp(): { seq: number; t: number } {
    this.k++
    this.t += 60 + ((this.k * 13) % 40) // 60–96ms, varied: no cadence flags
    return { seq: this.core.events.length + 1, t: this.t }
  }

  insert(text: string): void {
    const { seq, t } = this.stamp()
    this.core.dispatch(insertEvent(seq, t, text))
  }

  commit(): void {
    const { seq, t } = this.stamp()
    this.core.dispatch(commitEvent(seq, t))
  }

  deleteChar(): void {
    const { seq, t } = this.stamp()
    this.core.dispatch(deleteEvent(seq, t))
  }

  /** One keystroke through the adapter's routing (input/ui.vue). */
  typeChar(char: string, language?: string): void {
    const state = this.core.state
    const target = this.core.words[state.wordIndex] ?? ''
    const caret = bufferOf(state, state.wordIndex).length
    if (isSpaceGrapheme(char)) {
      const expected = target[caret]
      if (expected !== undefined && isSpaceGrapheme(expected)) {
        this.insert(normalizeGrapheme(char, expected, language))
        return
      }
      this.commit()
      return
    }
    this.insert(normalizeGrapheme(char, target[caret], language))
  }

  log(): EventLog {
    return { version: EVENT_LOG_VERSION, events: [...this.core.events] }
  }
}

const scrapeWord = (word: string, canary: Canary | null): string =>
  canary ? word.slice(0, canary.slot) + canary.grapheme + word.slice(canary.slot) : word

/**
 * The scraper: reads the RENDERED word (canary included), types it, follows
 * the UI — when the active word advances under it (the soft canary's forced
 * commit) it re-scrapes the new active word instead of typing a stale tail.
 * `botOnFirstSoft` limits how many soft canaries it falls for (threshold
 * boundary tests); the rest of the run it types the canonical word.
 */
function botRun(driver: AdapterDriver, seed: number, botOnFirstSoft?: number): void {
  let softUsed = 0
  let guard = 0
  while (driver.core.state.phase !== 'finished' && guard++ < 20000) {
    const idx = driver.core.state.wordIndex
    const word = driver.core.words[idx] ?? ''
    let canary = canaryAt(seed, idx, word)
    if (canary !== null && canary.grapheme === CANARY_SOFT && botOnFirstSoft !== undefined) {
      if (softUsed >= botOnFirstSoft) canary = null
      else softUsed++
    }
    for (const char of scrapeWord(word, canary)) {
      driver.typeChar(char)
      if (driver.core.state.wordIndex !== idx || driver.core.state.phase === 'finished') break
    }
    if (driver.core.state.phase === 'finished') break
    if (driver.core.state.wordIndex === idx) driver.typeChar(' ')
  }
  expect(driver.core.state.phase).toBe('finished')
}

/**
 * The honest player: types the CANONICAL words (a real player never sees a
 * canary — it is display-only). Options model human noise:
 * - `mistakeEvery`: a wrong char + backspace early in every Nth word;
 * - `sloppyAt`: word index → caret at which the player double-spaces (an
 *   accidental early commit, the coincidence the k>=3 threshold absorbs).
 */
function honestRun(
  driver: AdapterDriver,
  opts: {
    language?: string
    mistakeEvery?: number
    sloppyAt?: ReadonlyMap<number, number>
  } = {}
): void {
  let guard = 0
  while (driver.core.state.phase !== 'finished' && guard++ < 20000) {
    const idx = driver.core.state.wordIndex
    const word = driver.core.words[idx] ?? ''
    const sloppy = opts.sloppyAt?.get(idx)
    let typed = 0
    let committedEarly = false
    for (const char of word) {
      if (sloppy !== undefined && typed === sloppy) {
        driver.typeChar(' ', opts.language) // the accidental double-space
        committedEarly = true
        break
      }
      if (opts.mistakeEvery !== undefined && idx % opts.mistakeEvery === 2 && typed === 1) {
        driver.insert('z')
        driver.deleteChar()
      }
      driver.typeChar(char, opts.language)
      typed++
      if (driver.core.state.phase === 'finished') break
    }
    if (driver.core.state.phase === 'finished') break
    if (!committedEarly && driver.core.state.wordIndex === idx) driver.typeChar(' ', opts.language)
  }
  expect(driver.core.state.phase).toBe('finished')
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const DICTS: Record<string, Dictionary> = {
  english: {
    name: 'english',
    bcp47: 'en',
    words: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india']
  },
  russian: {
    name: 'russian',
    bcp47: 'ru',
    words: ['земля', 'вода', 'огонь', 'ветер', 'камень', 'дерево', 'птица', 'рыба']
  },
  arabic: {
    name: 'arabic',
    bcp47: 'ar',
    words: ['مرحبا', 'سلام', 'كتاب', 'مدرسة', 'جميلة', 'سعيدة']
  }
}

interface Setup {
  readonly words: readonly string[]
  readonly input: Omit<ValidateLogInput, 'log' | 'canariesArmed'>
}

function setupFor(dict: Dictionary, seed: number, generation: GenerationConfig, cfg: CoreConfig): Setup {
  const context = makeSeedContext(dict, seed, generation)
  const words = generateWords(dict, context)._unsafeUnwrap().words
  return {
    words,
    input: {
      seed,
      dictionary: dict,
      dictVersion: context.dictVersion,
      configSnapshot: { config: cfg, generation }
    }
  }
}

function report(setup: Setup, log: EventLog, canariesArmed?: boolean): ValidationReport {
  const result = validateLog(
    canariesArmed === undefined ? { ...setup.input, log } : { ...setup.input, log, canariesArmed }
  )
  return result._unsafeUnwrap()
}

const canaryFlags = (r: ValidationReport): readonly string[] =>
  r.flags.filter((f) => f.code === 'canary-grapheme' || f.code === 'canary-commit').map((f) => f.code)

/** Schedule census over a generated word list. */
function census(seed: number, words: readonly string[]): { soft: number; direct: number } {
  let soft = 0
  let direct = 0
  words.forEach((word, index) => {
    const canary = canaryAt(seed, index, word)
    if (canary === null) return
    if (canary.grapheme === CANARY_SOFT) soft++
    else direct++
  })
  return { soft, direct }
}

/** First seed whose generated words carry at least `soft`/`direct` canaries. */
function findSeed(dict: Dictionary, generation: GenerationConfig, minSoft: number, minDirect: number): number {
  for (let seed = 1; seed < 5000; seed++) {
    const generated = generateWords(dict, makeSeedContext(dict, seed, generation))
    if (generated.isErr()) continue
    const { soft, direct } = census(seed, generated.value.words)
    if (soft >= minSoft && direct >= minDirect) return seed
  }
  throw new Error('no seed with the required canary census in 5000 — RATE moved?')
}

// ── The bot is caught ───────────────────────────────────────────────────────

describe('a scraping bot against an armed validateLog', () => {
  const cfg = config()
  const generation = gen()
  const seed = findSeed(DICTS.english, generation, 4, 1)
  const setup = setupFor(DICTS.english, seed, generation, cfg)
  const driver = new AdapterDriver(cfg, setup.words)
  botRun(driver, seed)
  const log = driver.log()

  it('raises canary-grapheme with score 1 (direct evidence, zero-variance class)', () => {
    const armed = report(setup, log, true)
    expect(armed.verdict).toBe('valid')
    const direct = armed.flags.find((f) => f.code === 'canary-grapheme')
    expect(direct).toBeDefined()
    expect(direct?.score).toBe(1)
  })

  it('raises canary-commit with every soft canary hit and the pinned score curve', () => {
    const armed = report(setup, log, true)
    const positional = armed.flags.find((f) => f.code === 'canary-commit')
    const { soft } = census(seed, setup.words)
    expect(soft).toBeGreaterThanOrEqual(4)
    expect(positional).toBeDefined()
    expect(positional?.score).toBe(Math.min(1, (soft - 2) * 0.25))
    expect(positional?.detail).toContain(`${soft} commit(s)`)
  })

  it('disarmed (false and absent alike) reports ZERO canary flags, bit-identically', () => {
    const absent = report(setup, log)
    const explicit = report(setup, log, false)
    expect(explicit).toEqual(absent)
    expect(canaryFlags(absent)).toEqual([])
  })

  it('arming only APPENDS: the disarmed report is a strict prefix of the armed one', () => {
    const disarmed = report(setup, log)
    const armed = report(setup, log, true)
    expect(armed.verdict).toBe(disarmed.verdict)
    expect(armed.metrics).toEqual(disarmed.metrics)
    expect(armed.flags.slice(0, disarmed.flags.length)).toEqual(disarmed.flags)
    expect(canaryFlags(armed).length).toBe(armed.flags.length - disarmed.flags.length)
  })
})

describe('canary-commit threshold (k >= 3) and score pins', () => {
  const cfg = config()
  const generation = gen({ length: 80 })
  const seed = findSeed(DICTS.english, generation, 6, 0)
  const setup = setupFor(DICTS.english, seed, generation, cfg)

  const withSoftHits = (k: number): ValidationReport => {
    const driver = new AdapterDriver(cfg, setup.words)
    botRun(driver, seed, k)
    return report(setup, driver.log(), true)
  }

  it('2 hits: below threshold, no flag', () => {
    expect(withSoftHits(2).flags.find((f) => f.code === 'canary-commit')).toBeUndefined()
  })

  it('3 hits: flag at score 0.25', () => {
    expect(withSoftHits(3).flags.find((f) => f.code === 'canary-commit')?.score).toBe(0.25)
  })

  it('6 hits: flag saturates at 1.0', () => {
    const { soft } = census(seed, setup.words)
    expect(soft).toBeGreaterThanOrEqual(6)
    expect(withSoftHits(6).flags.find((f) => f.code === 'canary-commit')?.score).toBe(1)
  })
})

// ── The honest player is not ────────────────────────────────────────────────

describe('honest input never trips a canary flag (property, language matrix)', () => {
  const cases: [string, Dictionary, Partial<CoreConfig>, { language?: string; mistakeEvery?: number }][] = [
    ['english, clean', DICTS.english, {}, {}],
    ['english, wrong-char + backspace noise', DICTS.english, {}, { mistakeEvery: 3 }],
    ['english, freedom mode', DICTS.english, { freedomMode: true }, { mistakeEvery: 4 }],
    ['russian, clean', DICTS.russian, {}, { language: 'russian' }],
    ['russian, backspace noise', DICTS.russian, {}, { language: 'russian', mistakeEvery: 3 }],
    ['arabic (RTL), clean', DICTS.arabic, {}, {}]
  ]

  it.each(cases)('%s: zero canary flags across seeds, armed or not', (_label, dict, cfgOver, opts) => {
    for (const seed of [11, 42, 777]) {
      const cfg = config(cfgOver)
      const generation = gen({ length: 40 })
      const setup = setupFor(dict, seed, generation, cfg)
      const driver = new AdapterDriver(cfg, setup.words)
      honestRun(driver, opts)
      const log = driver.log()

      const armed = report(setup, log, true)
      expect(armed.verdict).toBe('valid')
      expect(canaryFlags(armed)).toEqual([])
      // And disarmed is bit-identical to armed for an honest log: the
      // detectors added nothing, so the reports must be deep-equal.
      expect(report(setup, log)).toEqual(armed)
    }
  })

  it('a sloppy human double-spacing mid-word does not reach the k>=3 threshold', () => {
    const cfg = config()
    const generation = gen({ length: 50 })
    const seed = 42
    const setup = setupFor(DICTS.english, seed, generation, cfg)
    // Ten accidental early commits at arbitrary human positions (caret 2–3),
    // spread over the run — far more slop than a real player produces.
    const sloppyAt = new Map<number, number>()
    for (let i = 3; i < 50; i += 5) sloppyAt.set(i, 2 + (i % 2))
    const driver = new AdapterDriver(cfg, setup.words)
    honestRun(driver, { sloppyAt })
    const armed = report(setup, driver.log(), true)
    // The early commits land where the HUMAN was, not where the seed put the
    // canaries; three exact coincidences do not accumulate. If this ever
    // fires, the threshold is too tight — stop and re-tune, do not delete.
    expect(armed.flags.find((f) => f.code === 'canary-commit')).toBeUndefined()
  })
})

// ── Quote runs ──────────────────────────────────────────────────────────────

describe('quote runs: detectors work, NBSP tokens are skipped', () => {
  const text = 'Молодость!\u00a0- пора надежд великих стремлений и мечтаний безграничных'
  const quote = { kind: 'quote', quoteId: 'q-canary-1', quoteHash: dictVersion([text]), text } as const
  const generation = gen({ mode: 'quote', length: 0, textSource: quote })
  const cfg = config({ mode: 'quote' })

  const seedFor = (): number => {
    const words = generateWords(DICTS.russian, makeSeedContext(DICTS.russian, 1, generation))
      ._unsafeUnwrap().words
    for (let seed = 1; seed < 5000; seed++) {
      if (census(seed, words).soft >= 3) return seed
    }
    throw new Error('no seed with 3 soft canaries on the quote words')
  }
  const seed = seedFor()
  const setup = setupFor(DICTS.russian, seed, generation, cfg)

  it('the NBSP token itself never carries a canary', () => {
    const nbspIndex = setup.words.findIndex((w) => w.includes('\u00a0'))
    expect(nbspIndex).toBeGreaterThanOrEqual(0)
    for (let s = 1; s < 200; s++) expect(canaryAt(s, nbspIndex, setup.words[nbspIndex])).toBeNull()
  })

  it('a bot on the quote is caught; a disarmed report is bit-identical to absent', () => {
    const driver = new AdapterDriver(cfg, setup.words)
    botRun(driver, seed)
    const log = driver.log()
    const armed = report(setup, log, true)
    expect(armed.verdict).toBe('valid')
    expect(armed.flags.find((f) => f.code === 'canary-commit')?.score).toBeGreaterThanOrEqual(0.25)
    expect(report(setup, log, false)).toEqual(report(setup, log))
  })

  it('an honest typist on the quote (NBSP typed as its own byte) raises nothing', () => {
    const driver = new AdapterDriver(cfg, setup.words)
    honestRun(driver, { language: 'russian' })
    const armed = report(setup, driver.log(), true)
    expect(armed.verdict).toBe('valid')
    expect(canaryFlags(armed)).toEqual([])
  })
})

// ── Nospace ─────────────────────────────────────────────────────────────────

describe('nospace: the positional detector is skipped, the direct one is not', () => {
  const cfg = config({ nospace: true })
  const generation = gen({ length: 30 })
  const seed = findSeed(DICTS.english, generation, 0, 1)
  const setup = setupFor(DICTS.english, seed, generation, cfg)

  it('a nospace bot leaks the direct canary but can never earn canary-commit', () => {
    const driver = new AdapterDriver(cfg, setup.words)
    // Nospace scraper: types the scraped stream; the ZWSP "space" it types is
    // routed to commit() and REFUSED (NospaceCommit), so it never reaches the
    // log — but the U+2063 insert does.
    let guard = 0
    while (driver.core.state.phase !== 'finished' && guard++ < 20000) {
      const idx = driver.core.state.wordIndex
      const word = driver.core.words[idx] ?? ''
      for (const char of scrapeWord(word, canaryAt(seed, idx, word))) {
        driver.typeChar(char)
        if (driver.core.state.wordIndex !== idx || driver.core.state.phase === 'finished') break
      }
      if (driver.core.state.wordIndex === idx && driver.core.state.phase !== 'finished') {
        // The bot's separator keystroke: inert in nospace (commit refused).
        driver.typeChar(' ')
        // Progression is insert-driven; if the word is stuck (canary insert
        // displaced a needed char), finish it with the canonical tail.
        for (const char of word.slice(bufferOf(driver.core.state, idx).length)) {
          driver.typeChar(char)
          if (driver.core.state.wordIndex !== idx || driver.core.state.phase === 'finished') break
        }
      }
    }
    expect(driver.core.state.phase).toBe('finished')

    const armed = report(setup, driver.log(), true)
    expect(armed.verdict).toBe('valid')
    expect(armed.flags.find((f) => f.code === 'canary-grapheme')).toBeDefined()
    expect(armed.flags.find((f) => f.code === 'canary-commit')).toBeUndefined()
  })

  it('honest nospace stays clean and bit-identical', () => {
    const driver = new AdapterDriver(cfg, setup.words)
    let guard = 0
    while (driver.core.state.phase !== 'finished' && guard++ < 20000) {
      const idx = driver.core.state.wordIndex
      for (const char of driver.core.words[idx] ?? '') {
        driver.typeChar(char)
        if (driver.core.state.phase === 'finished') break
      }
    }
    expect(driver.core.state.phase).toBe('finished')
    const log = driver.log()
    const armed = report(setup, log, true)
    expect(canaryFlags(armed)).toEqual([])
    expect(report(setup, log)).toEqual(armed)
  })
})

// ── Sanity: the codepoint set the direct detector scans ─────────────────────

describe('the direct detector scans the whole invisible-operator block', () => {
  it('any of U+2061..U+2064 in an insert raises the flag, not only the rendered one', () => {
    const cfg = config()
    const generation = gen({ length: 5 })
    const setup = setupFor(DICTS.english, 42, generation, cfg)
    for (const cp of CANARY_CODEPOINTS) {
      const driver = new AdapterDriver(cfg, setup.words)
      let first = true
      let guard = 0
      while (driver.core.state.phase !== 'finished' && guard++ < 5000) {
        const idx = driver.core.state.wordIndex
        const word = driver.core.words[idx] ?? ''
        for (const char of first ? word[0] + cp + word.slice(1) : word) {
          driver.typeChar(char)
        }
        first = false
        if (driver.core.state.phase !== 'finished') driver.typeChar(' ')
      }
      const armed = report(setup, driver.log(), true)
      expect(
        armed.flags.find((f) => f.code === 'canary-grapheme'),
        `U+${cp.codePointAt(0)?.toString(16)} must be scanned`
      ).toBeDefined()
    }
  })
})
