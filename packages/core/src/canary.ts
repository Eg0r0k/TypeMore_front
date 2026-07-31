/**
 * Seed-derived display canaries — the anti-scrape schedule.
 *
 * A canary is an invisible codepoint the RENDER layer weaves into one word's
 * letter stream. It exists nowhere else: not in `store.words`, not in the
 * dictionary or its fingerprint, not in an honest player's event log, and not
 * in anything `generateWords` returns. The word list, the log grammar and the
 * scoring pipeline are byte-identical with and without this module — that is
 * the design's whole safety story, and the property tests pin it.
 *
 * Why it catches anything: the trap is the input adapter's EXISTING behaviour,
 * not new code. A scraper that reads the rendered text (shadow root included)
 * and replays it as keystrokes will feed the canary back to the adapter:
 *
 * - `CANARY_SOFT` (U+200B, zero width space) is a member of `SPACE_CHARS`
 *   (normalize.ts), so the adapter treats it as a word separator. Typed
 *   mid-word — where the schedule put it — the target expects a letter, not a
 *   space, so `separateOrTypeSpace` COMMITS the half-typed word. The commit
 *   position is a pure function of the seed, which makes it server-checkable.
 * - `CANARY_DIRECT` (U+2063, invisible separator) is in NO equivalence group
 *   and is not a space variant, so `normalizeGrapheme` passes it through
 *   untouched and it lands in the log as a literal `insert`. No keyboard
 *   layout, IME or compose sequence produces it (paste is already flagged as
 *   `replace source:'paste'`), so its mere presence is direct evidence.
 *
 * The schedule is drawn from an INDEPENDENT PRNG stream per (seed, wordIndex):
 * `mulberry32(fnv1a("<seed>:canary:<wordIndex>"))`. It deliberately does NOT
 * share the generation PRNG — consuming draws there would shift every word
 * after the first canary and change what `generateWords` returns, which is
 * exactly the drift this module must never cause. A shared stream with a
 * reserved draw count was considered and rejected: it would freeze the number
 * of generation draws per word into a cross-repo contract for no benefit.
 *
 * DRAW ORDER IS THE WIRE FORMAT. The server's validator recomputes this
 * schedule from the same seed via the vendored bundle; reordering, adding or
 * removing a draw reshuffles every canary position and breaks the armed
 * detectors for in-flight runs. The order is:
 *
 *   draw 1 — participation: the word carries a canary iff draw < RATE (0.12);
 *   draw 2 — slot: uniform in [1, word.length - 1] (UTF-16 code units);
 *   draw 3 — grapheme: SOFT below SOFT_SHARE (0.8), DIRECT otherwise.
 *
 * Draws 2–3 happen only for a participating word: every word has its own
 * stream, so the early return shifts nothing (pinned by the schedule tests).
 *
 * Slot semantics, shared with the render layer and the commit detector: the
 * canary sits BETWEEN code units `slot - 1` and `slot` of the target, so in
 * scraped text it appears at offset `slot`, and a bot that types the scraped
 * bytes commits when the typed buffer is exactly `slot` units long. `0` is
 * excluded (a commit on an empty buffer is a human double-space, no evidence)
 * and `word.length` is excluded (a commit on the full buffer is a normal
 * commit, no evidence).
 *
 * Skips (return `null`) — every one is a word where the trap would misfire:
 * - length < 4: too short for an interior slot to be meaningfully rare;
 * - any typable space variant inside (`isSpaceGrapheme`): the adapter would
 *   store the EXPECTED variant (an NBSP quote token's own byte), turning the
 *   canary into a correct keystroke instead of a commit;
 * - `\t` or `\n` inside: code/quote layout tokens with their own commit rules;
 * - surrogate code units: the slot contract is in UTF-16 units, and splitting
 *   a surrogate pair renders tofu — skipping is cheaper than a grapheme-aware
 *   slot rule nobody needs (dictionaries are overwhelmingly BMP);
 * - any of `CANARY_CODEPOINTS` already inside: a poisoned dictionary must not
 *   let a "legitimate" canary mask the direct evidence.
 */

import { isSpaceGrapheme } from './normalize'
import { fnv1a, mulberry32 } from './words'

/** U+200B zero width space: a `SPACE_CHARS` member → forces a mid-word commit. */
export const CANARY_SOFT = '\u200b'

/** U+2063 invisible separator: untouched by normalize → a literal log insert. */
export const CANARY_DIRECT = '\u2063'

/**
 * Every codepoint the direct detector scans for: the invisible-operator block
 * U+2061..U+2064 (function application, invisible times, invisible separator,
 * invisible plus). Only U+2063 is ever RENDERED today; the detector watches
 * the whole block so a future rotation of the rendered character needs no
 * server change, and so all four are barred from canary-carrying words.
 */
export const CANARY_CODEPOINTS: ReadonlySet<string> = new Set([
  '\u2061',
  '\u2062',
  '\u2063',
  '\u2064'
])

/** Share of eligible words that carry a canary (draw 1 threshold). */
const RATE = 0.12
/** Share of canaries that are SOFT rather than DIRECT (draw 3 threshold). */
const SOFT_SHARE = 0.8

export interface Canary {
  /**
   * Position in UTF-16 code units, in `[1, word.length - 1]`: the canary sits
   * between units `slot - 1` and `slot`, i.e. at offset `slot` of the scraped
   * text.
   */
  readonly slot: number
  /** The invisible codepoint to render: `CANARY_SOFT` or `CANARY_DIRECT`. */
  readonly grapheme: string
}

/**
 * The canary for word `wordIndex` of the run seeded by `seed`, or `null` when
 * the word sits out (not drawn, or skipped — see the module comment). Pure and
 * deterministic: the client's render layer and the server's validator call
 * this with the same three arguments and MUST get the same answer; that is the
 * entire contract.
 */
export function canaryAt(seed: number, wordIndex: number, word: string): Canary | null {
  if (word.length < 4) return null
  for (let i = 0; i < word.length; i++) {
    const unit = word.charCodeAt(i)
    if (unit >= 0xd800 && unit <= 0xdfff) return null
    const char = word[i]
    if (char === '\t' || char === '\n') return null
    if (isSpaceGrapheme(char)) return null
    if (CANARY_CODEPOINTS.has(char)) return null
  }
  const rng = mulberry32(fnv1a(`${seed}:canary:${wordIndex}`))
  if (rng() >= RATE) return null // draw 1: participation
  const slot = 1 + Math.floor(rng() * (word.length - 1)) // draw 2: slot
  const grapheme = rng() < SOFT_SHARE ? CANARY_SOFT : CANARY_DIRECT // draw 3: grapheme
  return { slot, grapheme }
}
