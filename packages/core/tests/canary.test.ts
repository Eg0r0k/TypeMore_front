// @vitest-environment node
//
// The canary schedule (canary.ts) — the anti-scrape contract. Three layers:
//
// 1. NORMALIZE PINS. The trap rides on normalize.ts behaviour that predates it:
//    U+200B is a space variant (forces the mid-word commit) and U+2063 is
//    untouched (lands literally in the log). A future "cleanup" of SPACE_CHARS
//    or a new equivalence group could silently disarm the whole mechanism —
//    these tests are the tripwire, and their failure message says so.
// 2. SCHEDULE PINS. The draw order IS a cross-repo wire format (the server's
//    goja bundle recomputes it): hardcoded (seed, index, word) → result values
//    freeze it. If one of these fails, the schedule changed and every armed
//    run in flight is now judged against a different canary layout.
// 3. INDEPENDENCE. generateWords must be bit-identical with the module in the
//    graph and in use — the canary PRNG stream never touches the generation
//    stream, and no generation module imports canary.ts.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  CANARY_CODEPOINTS,
  CANARY_DIRECT,
  CANARY_SOFT,
  type Dictionary,
  type GenerationConfig,
  canaryAt,
  generateWords,
  isSpaceGrapheme,
  makeSeedContext,
  normalizeGrapheme
} from '@typemore/core'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

describe('normalize pins the canary trap rides on', () => {
  it('U+200B (CANARY_SOFT) IS a space grapheme — removing it from SPACE_CHARS disarms the trap', () => {
    expect(isSpaceGrapheme(CANARY_SOFT)).toBe(true)
  })

  it('U+2063 (CANARY_DIRECT) is NOT a space grapheme', () => {
    expect(isSpaceGrapheme(CANARY_DIRECT)).toBe(false)
  })

  it.each([
    ['latin', 'a'],
    ['cyrillic', 'б'],
    ['arabic', 'م'],
    ['space', ' ']
  ])(
    'normalizeGrapheme passes U+2063 through untouched against a %s expected char',
    (_label, expected) => {
      expect(normalizeGrapheme(CANARY_DIRECT, expected)).toBe(CANARY_DIRECT)
      expect(normalizeGrapheme(CANARY_DIRECT, expected, 'russian')).toBe(CANARY_DIRECT)
    }
  )

  it('no canary codepoint ever joins SPACE_CHARS or an equivalence group', () => {
    for (const cp of CANARY_CODEPOINTS) {
      expect(isSpaceGrapheme(cp), `U+${cp.codePointAt(0)?.toString(16)} must stay a non-space`).toBe(
        cp === '\u200b' // never true: U+200B is deliberately NOT in CANARY_CODEPOINTS
      )
      expect(normalizeGrapheme(cp, 'x')).toBe(cp)
    }
  })
})

describe('canaryAt — the pinned schedule (draw order is the wire format)', () => {
  // Values computed once from the shipped draw order:
  //   draw 1 participation (< 0.12), draw 2 slot, draw 3 grapheme (< 0.8 SOFT).
  // A failure here means the schedule MOVED: seed streams, draw order or
  // thresholds changed, and the server now disagrees with every armed client.
  it.each([
    [42, 0, 'hello', null],
    [42, 18, 'question', { slot: 5, grapheme: CANARY_DIRECT }],
    [42, 23, 'question', { slot: 3, grapheme: CANARY_SOFT }],
    [42, 23, 'привет', { slot: 2, grapheme: CANARY_SOFT }],
    [42, 18, 'مرحبا', { slot: 3, grapheme: CANARY_DIRECT }],
    [0xdeadbeef, 1, 'world', { slot: 1, grapheme: CANARY_DIRECT }]
  ] as const)('canaryAt(%d, %d, %j) is pinned', (seed, index, word, expected) => {
    expect(canaryAt(seed, index, word)).toEqual(expected)
  })

  it('is deterministic: same (seed, index, word) → same answer, always', () => {
    for (let i = 0; i < 50; i++) {
      expect(canaryAt(7, i, 'determinism')).toEqual(canaryAt(7, i, 'determinism'))
    }
  })

  it('participation does not depend on the word — only slot and eligibility do', () => {
    // (42, 23) participates for every eligible word; the slot scales with length.
    expect(canaryAt(42, 23, 'question')).not.toBeNull()
    expect(canaryAt(42, 23, 'привет')).not.toBeNull()
    expect(canaryAt(42, 23, 'مرحبا')).not.toBeNull()
  })
})

describe('canaryAt — slot bounds', () => {
  it('slot is always in [1, word.length - 1] (never 0, never length)', () => {
    const words = ['abcd', 'typing', 'привет', 'مرحبا', 'extraordinarily']
    let hits = 0
    for (let seed = 1; seed <= 40; seed++) {
      for (let index = 0; index < 200; index++) {
        const word = words[index % words.length]
        const canary = canaryAt(seed, index, word)
        if (canary === null) continue
        hits++
        expect(canary.slot).toBeGreaterThanOrEqual(1)
        expect(canary.slot).toBeLessThanOrEqual(word.length - 1)
        expect(Number.isInteger(canary.slot)).toBe(true)
        expect([CANARY_SOFT, CANARY_DIRECT]).toContain(canary.grapheme)
      }
    }
    // ~12% of 8000 draws — if this is 0 the PRNG stream broke, not the bounds.
    expect(hits).toBeGreaterThan(400)
  })
})

describe('canaryAt — skips', () => {
  /** First index the seed schedule draws for this word, so a skip test cannot pass vacuously. */
  const participatingIndex = (probe: string): number => {
    for (let index = 0; index < 1000; index++) {
      if (canaryAt(42, index, probe) !== null) return index
    }
    throw new Error('no participating index in 1000 draws — RATE broke')
  }

  it('skips words shorter than 4 code units', () => {
    const index = participatingIndex('abcd')
    expect(canaryAt(42, index, 'abc')).toBeNull()
    expect(canaryAt(42, index, '')).toBeNull()
  })

  it.each([
    ['NBSP inside (quote token)', 'Молодость!\u00a0-'],
    ['narrow NBSP inside (French quote token)', 'foo\u202fbar'],
    ['tab inside (code indentation token)', '\tconsole.log('],
    ['newline token (code line end)', 'align:\n'],
    ['lone newline token (blank line)', '\n\n\n\n'],
    ['surrogates (emoji)', 'ab😀cd'],
    ['canary codepoint already inside (poisoned dictionary)', 'ab\u2063cd']
  ])('skips a word with %s', (_label, word) => {
    // Vacuum guard: an equal-length clean word DOES participate at this index,
    // so the null below is the skip rule firing, not the participation draw.
    const clean = 'x'.repeat(Math.max(4, word.length))
    const index = participatingIndex(clean)
    expect(canaryAt(42, index, clean)).not.toBeNull()
    expect(canaryAt(42, index, word)).toBeNull()
  })

  it('language matrix: plain LTR and RTL words DO participate', () => {
    for (const word of ['question', 'привет', 'مرحبا', 'שלום']) {
      expect(canaryAt(42, participatingIndex(word), word)).not.toBeNull()
    }
  })
})

describe('generation independence', () => {
  const dict: Dictionary = {
    name: 'test',
    bcp47: 'en',
    words: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']
  }
  const gen = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
    mode: 'words',
    length: 40,
    punctuation: true,
    numbers: true,
    randomCase: false,
    reverse: false,
    ...over
  })

  it('generateWords is bit-identical no matter how much the canary stream is consumed', () => {
    for (const seed of [1, 42, 1337, 0xdeadbeef]) {
      const context = makeSeedContext(dict, seed, gen())
      const before = generateWords(dict, context)._unsafeUnwrap().words
      // Hammer the canary stream between generations — same seed, same indices.
      for (let index = 0; index < 500; index++) canaryAt(seed, index, 'interleaved')
      const after = generateWords(dict, context)._unsafeUnwrap().words
      expect(after).toEqual(before)
    }
  })

  it('no generation module imports canary.ts (static scan, purity-test style)', () => {
    for (const file of ['words.ts', 'game-core.ts', 'events.ts', 'stats.ts', 'score.ts']) {
      // Path is a fixed in-repo listing, not user input.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const source = readFileSync(join(srcDir, file), 'utf8')
      expect(/from ['"]\.\/canary['"]/.test(source), `${file} must not import canary`).toBe(false)
    }
  })

  it('the canary words in generated output stay canonical (no invisible codepoints)', () => {
    const context = makeSeedContext(dict, 42, gen())
    const { words } = generateWords(dict, context)._unsafeUnwrap()
    for (const word of words) {
      expect(word.includes(CANARY_SOFT)).toBe(false)
      for (const cp of CANARY_CODEPOINTS) expect(word.includes(cp)).toBe(false)
    }
  })
})
