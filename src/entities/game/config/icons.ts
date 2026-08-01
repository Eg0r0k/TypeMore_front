/**
 * The glyph each game option is drawn with — the registry's visual half.
 *
 * Separate from `registry.ts` on purpose: that file is pure meta (types,
 * predicates, i18n keys) and nothing in it imports a Vue component. Icons are
 * components, and `~icons/*` is a build-time transform, so keeping them here
 * leaves the registry importable by anything — including a test that only wants
 * to know which options exist.
 *
 * EXHAUSTIVENESS is the same mechanism the registry uses for contexts: these are
 * `Record<GameOptionKey, Component>`, so adding an option to `Config` without
 * choosing a glyph fails `vue-tsc` rather than rendering a blank square. That
 * matters more than usual here — four of these options are drawn with NO label
 * (`docs`: the boolean mods are icon-only), so a missing icon is a button with
 * nothing in it at all.
 *
 * Choices worth defending, since none of them is obvious:
 *  - `punctuation` → `at`. Not a comma glyph, because tabler has none that reads
 *    as punctuation at 16px; `@` is the convention monkeytype set and players
 *    arrive already knowing it.
 *  - `blind` / `fading` / `flashlight` are the three that a reader cannot
 *    guess apart, so they get maximally distinct shapes rather than three
 *    variations on an eye: a struck-through eye, a half-filled drop, and a
 *    focus reticle.
 *  - `reverse` → `flip-horizontal`, a mirror, because the mod mirrors each word
 *    rather than reordering the list (`reverseWord` in shared/core).
 *  - `lazy` → `zzz`, the option's NAME rather than its mechanism. Nothing in the
 *    set draws "a letter minus its diacritic" legibly at 16px, and the three
 *    letter-shaped glyphs already in use (`abc`, `letter-case-toggle`,
 *    `numbers`) would make a fourth one unreadable in the row.
 *  - `minWpm` → `gauge`: a floor on speed, not a timer.
 */
import type { Component } from 'vue'

import IconAt from '~icons/tabler/at'
import IconNumbers from '~icons/tabler/numbers'
import IconLetterCase from '~icons/tabler/letter-case-toggle'
import IconFlipHorizontal from '~icons/tabler/flip-horizontal'
import IconEyeOff from '~icons/tabler/eye-off'
import IconDropletHalf from '~icons/tabler/droplet-half-2'
import IconFocus from '~icons/tabler/focus-2'
import IconSpaceOff from '~icons/tabler/space-off'
import IconFlame from '~icons/tabler/flame'
import IconGauge from '~icons/tabler/gauge'
import IconAbc from '~icons/tabler/abc'
import IconClock from '~icons/tabler/clock'
import IconQuote from '~icons/tabler/quote'
import IconLanguage from '~icons/tabler/language'
import IconRulerMeasure from '~icons/tabler/ruler-measure'
import IconBackspace from '~icons/tabler/backspace'
import IconHandStop from '~icons/tabler/hand-stop'
import IconTrackNext from '~icons/tabler/player-track-next'
import IconZzz from '~icons/tabler/zzz'

import type { GameOptionKey } from './registry'

/** One glyph per game option. Exhaustive by type — see the note above. */
export const OPTION_ICONS: Record<GameOptionKey, Component> = {
  // Shape of the run
  mode: IconAbc,
  time: IconClock,
  words: IconAbc,
  quoteGroup: IconRulerMeasure,
  language: IconLanguage,
  // Word-affecting mods
  punctuation: IconAt,
  numbers: IconNumbers,
  randomCase: IconLetterCase,
  reverse: IconFlipHorizontal,
  lazy: IconZzz,
  // Freemods
  difficulty: IconFlame,
  minWpm: IconGauge,
  nospace: IconSpaceOff,
  // Input behaviour
  freedomMode: IconBackspace,
  stopOnError: IconHandStop,
  quickEnd: IconTrackNext,
  // Visual mods
  blind: IconEyeOff,
  fading: IconDropletHalf,
  flashlight: IconFocus
}

/**
 * The mode VALUES carry their own glyphs — mode is the control players touch
 * most, and `words` / `time` / `quote` are three different kinds of run rather
 * than three settings of one. `free` and `custom` exist in `ConfigModes` but no
 * surface offers them, so they are absent here rather than given a placeholder.
 */
const MODE_ICONS: Record<string, Component | undefined> = {
  words: IconAbc,
  time: IconClock,
  quote: IconQuote
}

/**
 * The glyph for a mode value, or `undefined` for one that has none. A lookup
 * rather than the record itself: the caller iterates `valuesFor(mode, context)`,
 * which is `readonly string[]` — the registry does not narrow enum values to
 * literals, and a template indexing a `Record` with a `string` does not compile.
 */
export const modeIconOf = (mode: string): Component | undefined => MODE_ICONS[mode]
