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
 * Where a run's targets come from.
 *
 * `seeded` is the historical behaviour: the PRNG draws tokens out of a
 * dictionary. `quote` is a FIXED TEXT — everyone types the same bytes, so the
 * text itself governs the run and the dictionary is not consulted at all.
 *
 * The core never fetches: `text` arrives already resolved (the page calls
 * `/quotes/random`, the server re-resolves it by id on submission).
 */
export interface SeededTextSource {
  readonly kind: 'seeded'
}

/**
 * A quote WITHOUT its bytes — the id/hash pair that names one immutable text
 * forever. This is what a run submits (`build-payload.ts`): the server
 * re-resolves the text by `quoteId` and checks it against `quoteHash`, so the
 * client's copy of the text is never the thing the server trusts.
 */
export interface QuoteRef {
  readonly kind: 'quote'
  readonly quoteId: string
  /** `dictVersion([text])` — the server's `textHash`, same FNV-1a convention. */
  readonly quoteHash: string
}

/** A quote as the CORE sees it: the ref plus the resolved bytes. */
export interface QuoteTextSource extends QuoteRef {
  readonly text: string
}

export type GenerationTextSource = SeededTextSource | QuoteTextSource

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
  /**
   * Magnitude for the mode: word count for `words`/`custom`, seconds for
   * `time`/`free`. A run with a `quote` `textSource` has NO magnitude — its
   * length is the text's — and carries `0`.
   */
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
  /**
   * Where the targets come from. ABSENT MEANS `seeded` — that is what keeps
   * `EVENT_LOG_VERSION` at 1: every log, golden vector and stored config
   * snapshot written before quotes existed reconstructs byte-identically,
   * because the seeded branch below is reached by exactly the same code path it
   * always was.
   *
   * It lives here and not in `CoreConfig` because it decides what the targets
   * ARE (slot invariant, docs/game-architecture.md) — so it travels in the seed
   * context and every replay/`validateLog` reconstructs from it.
   */
  readonly textSource?: GenerationTextSource
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

export type WordsErrorKind = 'EmptyDictionary' | 'DictVersionMismatch' | 'EmptyQuote'

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

/** The quote arm of `textSource`, or `undefined` for a seeded run. */
export function quoteOf(gen: GenerationConfig): QuoteTextSource | undefined {
  return gen.textSource?.kind === 'quote' ? gen.textSource : undefined
}

/**
 * True when the run's targets are emitted VERBATIM: no `decorate` transform
 * (numbers, randomCase, capitalization, punctuation) and no reverse mirror.
 *
 * ONE predicate, two callers, so the two can never disagree: `generateWords`
 * skips the transforms, and `activeModsV1` (mods.ts) withholds the
 * word-affecting multipliers. Crediting a punctuation multiplier for
 * punctuation the run did not choose — the author of a code token or a quote
 * did — would pay for a mod that was never applied.
 */
export function emitsRawTokens(gen: GenerationConfig): boolean {
  return gen.rawTokens === true || gen.textSource?.kind === 'quote'
}

/**
 * The seed context for a run: the seed, the generation config, and the CONTENT
 * HASH of whatever the targets are generated from.
 *
 * For a seeded run that hash is the dictionary's fingerprint, as it always was.
 * For a QUOTE run the dictionary is not read at all, so hashing it would freeze
 * an artefact the run does not depend on (and `code_python` /
 * `code_javascript` are quote-only — they have no served dictionary to hash).
 * The text IS the corpus of a quote run, so its content hash is
 * `dictVersion([text])` — which is bit-for-bit the server's `textHash`
 * (QUOTES.md: `text_hash = core.DictVersion([]string{quote.Text})`, a
 * one-element slice so the NUL join is a no-op, and therefore the same artefact
 * `dictHash` already is). The drift guard keeps meaning exactly what it meant:
 * "the bytes this run was generated from still hash to what it recorded".
 */
export function makeSeedContext(
  dict: Dictionary,
  seed: number,
  generation: GenerationConfig
): SeedContext {
  const quote = quoteOf(generation)
  return {
    seed,
    dictVersion: quote ? dictVersion([quote.text]) : dictVersion(dict.words),
    generation
  }
}

// ── Generation ────────────────────────────────────────────────────────────────

const NUMBER_WEIGHT = 0.2
const PUNCTUATION_WEIGHT = 0.25
const SENTENCE_END = ['.', '?', '!']
const MID_PUNCTUATION = [',', ';', ':']

/**
 * Number of target words to pre-generate for the given generation config.
 *
 * A real quote run never gets here: `generateWords` returns the text's own
 * words before any count is computed, so a quote has no length target and ends
 * on its last committed word. `mode: 'quote'` with NO `textSource` is a config
 * that names a fixed text and supplies none — it degrades to the seeded
 * word-count path rather than inventing a length.
 */
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
 * Two sources, one function (`context.generation.textSource`):
 *
 * - **seeded** (or absent, the legacy shape): draw tokens from the dictionary
 *   with the seeded PRNG. Fails if the dictionary is empty, or if the context's
 *   `dictVersion` does not match the dictionary actually passed in.
 * - **quote**: the targets ARE the text. The dictionary is never touched — not
 *   read, not hashed, not required to be non-empty — and the PRNG is never
 *   constructed, so `seed` cannot influence a single byte of the output.
 *   `dictVersion` is checked against the TEXT instead (see `makeSeedContext`),
 *   which is the same drift guard aimed at the artefact that actually governs
 *   the run.
 */
export function generateWords(
  dict: Dictionary,
  context: SeedContext
): Result<GeneratedWords, WordsError> {
  const quote = quoteOf(context.generation)
  if (quote) {
    const actualHash = dictVersion([quote.text])
    if (actualHash !== context.dictVersion) {
      return err({
        kind: 'DictVersionMismatch',
        message: `quote ${quote.quoteId} text hash mismatch: context=${context.dictVersion} actual=${actualHash}`
      })
    }
    // Split on the SPACE character only, and drop empties. A run of spaces, a
    // leading space or a trailing newline+space would otherwise produce a
    // zero-length target, which is not a typeable word: the reducer would have
    // nothing to compare a keystroke against and the player could never satisfy
    // it. Everything else in the text is preserved verbatim, `\n` and `\t`
    // included — they belong to the token they sit in, exactly as a code
    // dictionary's tokens carry their own layout.
    const words = quote.text.split(' ').filter((word) => word.length > 0)
    if (words.length === 0) {
      return err({ kind: 'EmptyQuote', message: `quote ${quote.quoteId} has no typeable words` })
    }
    // No `mulberry32`, no `targetCount`, no `decorate`: the seed cannot reach
    // the output, and the run's length is the quote's — it ends when the last
    // word is committed (the reducer's count-mode finish, `game-core.ts`).
    return ok({ words, context, dictName: dict.name })
  }

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
  // Raw tokens: the dictionary IS the text (code). No transform runs, so the
  // only PRNG draw per word is the index one — still fully deterministic.
  const raw = emitsRawTokens(context.generation)
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
