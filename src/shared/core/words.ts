/**
 * Deterministic word generation for the game core.
 *
 * Rules (from the accepted architecture):
 * - The core never calls `Math.random`. Randomness comes from an explicit
 *   `mulberry32` PRNG seeded by an *externally supplied* seed. In ranked modes
 *   the server hands out the seed; the core never invents one.
 * - The seed context carries the dictionary version (a content hash of the full
 *   word list). If the dictionary changes, its version changes, so a replay
 *   generated against the old dictionary is detected instead of silently
 *   drifting into a different word list.
 * - The seed context also carries the generation config subset that affects
 *   output (mode/length, punctuation, numbers). Same context + same dictionary
 *   => byte-identical word list, on any machine (client or server).
 * - Words are generated up front (whole list, or deterministic chunks), never
 *   lazily during the test — lazy generation is what blocks multiplayer sync.
 */

import { Result, err, ok } from 'neverthrow'

export interface Dictionary {
  readonly name: string
  readonly bcp47: string
  readonly words: readonly string[]
}

export type GenerationMode = 'words' | 'time' | 'quote' | 'free' | 'custom'

/**
 * The config subset that changes generated output. Kept separate from the app
 * `Config` so the store maps only the fields that matter; anything not here
 * (theme, sound, font…) must not affect the word list.
 *
 * INVARIANT — read before adding any option here or to `CoreConfig`:
 * If an option influences word GENERATION or the VALIDITY of input, it MUST live
 * in `GenerationConfig` (→ the seed context) or `CoreConfig` (→ the reducer
 * snapshot). Both are part of what a replay / `validateLog` reconstructs; an
 * option that changes behaviour but lives outside them makes the server's replay
 * diverge from the client's. Concretely: word mutations derived from the original
 * dictionary (capitalization, suffixes, punctuation, numbers…) are deterministic
 * transforms driven by the SAME PRNG — their toggles belong here. Timed vs
 * word-count already lives in `mode`.
 */
export interface GenerationConfig {
  readonly mode: GenerationMode
  /** Magnitude for the mode: word count for `words`/`custom`/`quote`, seconds for `time`/`free`. */
  readonly length: number
  readonly punctuation: boolean
  readonly numbers: boolean
  readonly randomCase: boolean
  /** Mirror each generated word (Reverse mod). Applied last, see `generateWords`. */
  readonly reverse: boolean
  /**
   * Emit dictionary tokens VERBATIM: no `decorate` transform (numbers,
   * randomCase, capitalization, punctuation) and no reverse mirror.
   *
   * Code dictionaries ship their own case, punctuation and layout — a token is
   * `);\n` or `\tconsole.log(`, and appending a comma or upper-casing the first
   * character would produce text no editor ever contains. Optional with a
   * legacy default of `false`: a config snapshot written before this field
   * existed must reconstruct the old word list exactly (same rule as the
   * optional `CoreConfig` fields).
   */
  readonly rawTokens?: boolean
}

export interface SeedContext {
  readonly seed: number
  readonly dictVersion: string
  readonly generation: GenerationConfig
}

export interface GeneratedWords {
  readonly words: readonly string[]
  readonly context: SeedContext
  readonly dictName: string
}

export type WordsErrorKind = 'EmptyDictionary' | 'DictVersionMismatch'

export interface WordsError {
  readonly kind: WordsErrorKind
  readonly message: string
}

// ── PRNG ─────────────────────────────────────────────────────────────────────

/**
 * mulberry32: tiny, fast, fully specified 32-bit PRNG. Given the same 32-bit
 * seed it yields the same sequence of floats in [0, 1) on every engine, which
 * is exactly what deterministic replay needs.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * FNV-1a 32-bit hash over UTF-16 code units. Used as the dictionary content
 * hash: any change to the word list — including swapping one word while the
 * count stays the same — changes the digest, and therefore the version.
 */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Content hash of a word list. Words are joined with a NUL separator so that
 * boundaries are significant: `['ab','c']` and `['a','bc']` hash differently.
 */
export function dictVersion(words: readonly string[]): string {
  return fnv1a(words.join('\u0000')).toString(16).padStart(8, '0')
}

export function makeSeedContext(
  dict: Dictionary,
  seed: number,
  generation: GenerationConfig
): SeedContext {
  return { seed, dictVersion: dictVersion(dict.words), generation }
}

// ── Generation ────────────────────────────────────────────────────────────────

const NUMBER_WEIGHT = 0.2
const PUNCTUATION_WEIGHT = 0.25
const SENTENCE_END = ['.', '?', '!']
const MID_PUNCTUATION = [',', ';', ':']

/** Number of target words to pre-generate for the given generation config. */
function targetCount(gen: GenerationConfig): number {
  switch (gen.mode) {
    case 'words':
    case 'custom':
    case 'quote':
      return Math.max(1, Math.floor(gen.length))
    case 'time':
      // Enough headroom for a very fast typist (~6 words/s) over the duration.
      return Math.max(60, Math.ceil(gen.length * 6))
    case 'free':
      return Math.max(60, Math.floor(gen.length) || 100)
  }
}

/** Random integer in [0, max) from a PRNG draw. */
function randomInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max)
}

/**
 * Apply the deterministic per-word transforms in a FIXED order — each consumes the
 * shared PRNG in this order, so the whole sequence is reproducible:
 *   1. numbers      — may replace the whole token with a digit string (skips 2–4)
 *   2. randomCase   — randomize the case of every character
 *   3. capitalization — force the sentence-start word's first letter upper
 *   4. punctuation  — append a trailing mark
 * A 5th transform — reverse (Reverse mod) — is applied by `generateWords` to the
 * decorated word AFTER sentence-boundary detection, so it consumes no PRNG and
 * does not shift capitalization: reverse-on targets are exact mirrors of
 * reverse-off targets at the same seed.
 */
function decorate(
  word: string,
  gen: GenerationConfig,
  rng: () => number,
  capitalizeNext: boolean
): string {
  if (gen.numbers && rng() < NUMBER_WEIGHT) {
    // Replace the whole token with a 1–4 digit number (deterministic).
    const digits = 1 + randomInt(rng, 4)
    let n = ''
    for (let i = 0; i < digits; i++) n += String(randomInt(rng, 10))
    return n
  }
  let out = word
  if (gen.randomCase) {
    let cased = ''
    for (const ch of out) cased += rng() < 0.5 ? ch.toUpperCase() : ch.toLowerCase()
    out = cased
  }
  if (capitalizeNext && out.length > 0) out = out[0].toUpperCase() + out.slice(1)
  if (gen.punctuation && rng() < PUNCTUATION_WEIGHT) {
    const end = SENTENCE_END[randomInt(rng, SENTENCE_END.length)]
    const mid = MID_PUNCTUATION[randomInt(rng, MID_PUNCTUATION.length)]
    // Sentence-ending punctuation is rarer than mid-sentence marks.
    out += rng() < 0.5 ? end : mid
  }
  return out
}

/** Mirror a word by code point (Reverse mod). Pure, consumes no PRNG. */
export function reverseWord(word: string): string {
  return [...word].reverse().join('')
}

/**
 * Generate the full target word list for a test. Deterministic in
 * `(dictionary, context)`: same inputs always yield the same list.
 *
 * Fails if the dictionary is empty, or if the context's `dictVersion` does not
 * match the dictionary actually passed in (drift protection).
 */
export function generateWords(
  dict: Dictionary,
  context: SeedContext
): Result<GeneratedWords, WordsError> {
  if (dict.words.length === 0) {
    return err({ kind: 'EmptyDictionary', message: `dictionary "${dict.name}" has no words` })
  }
  const actualVersion = dictVersion(dict.words)
  if (actualVersion !== context.dictVersion) {
    return err({
      kind: 'DictVersionMismatch',
      message: `dictionary version mismatch: context=${context.dictVersion} actual=${actualVersion}`
    })
  }

  const rng = mulberry32(context.seed)
  const count = targetCount(context.generation)
  // Raw tokens: the dictionary IS the text (code, quotes). No transform runs, so
  // the only PRNG draw per word is the index one — still fully deterministic.
  const raw = context.generation.rawTokens === true
  const words: string[] = []
  let prevIndex = -1
  let capitalizeNext = !raw && context.generation.punctuation // start of a sentence

  for (let i = 0; i < count; i++) {
    let index = randomInt(rng, dict.words.length)
    // Avoid immediate repetition when the dictionary is large enough.
    if (index === prevIndex && dict.words.length > 1) index = (index + 1) % dict.words.length
    prevIndex = index

    const base = dict.words[index]
    if (raw) {
      words.push(base)
      continue
    }
    const decorated = decorate(base, context.generation, rng, capitalizeNext)
    // Transform 5 (reverse): mirror the decorated word for output only. Sentence
    // detection below still reads `decorated`, so PRNG/capitalization are identical
    // to a reverse-off run at the same seed (exact mirror; see the transform-order note).
    words.push(context.generation.reverse ? reverseWord(decorated) : decorated)
    // Next word is capitalized when this one ended a sentence.
    capitalizeNext =
      context.generation.punctuation && SENTENCE_END.includes(decorated[decorated.length - 1] ?? '')
  }

  return ok({ words, context, dictName: dict.name })
}
