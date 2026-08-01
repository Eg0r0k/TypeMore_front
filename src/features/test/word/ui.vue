<template>
  <div class="word" :class="{ active: props.active, 'word--error': hasError }">
    <span
      v-for="(letter, i) in letters"
      :key="i"
      class="letter"
      :class="[
        letter.state,
        { 'letter--ws': letter.ws, 'letter--tab': letter.tab, 'letter--dead': letter.dead }
      ]"
    >
      {{ letter.display }}
    </span>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onUpdated } from 'vue'

  import type { Canary } from '@typemore/core'

  /**
   * One component per word (never per letter). Letters are keyed `<span>`s whose
   * class comes from a pure `(target, typed, committed) -> state[]` derivation —
   * no innerHTML rebuild. The parent applies `v-memo` keyed on
   * `[word, typed, active, committed, blind, canaryKey]`, so a word re-renders
   * exactly when something it displays changes (including on commit, when
   * `active`/`committed` flip).
   *
   * `blind` is a view-only setting (never in the core/log): it hides correctness, so
   * every typed character renders neutral, untyped tails are not shown as missed,
   * and the word error underline is suppressed.
   */
  interface Props {
    word: string
    typed: string
    active: boolean
    /** True once the word has been committed (its untyped tail counts as missed). */
    committed?: boolean
    blind?: boolean
    /**
     * Display-layer canary (@typemore/core canary.ts), computed by the field
     * from the run's seed. STRICTLY presentational: the invisible grapheme is
     * appended to the text content of the letter span at `slot - 1`, so the
     * span COUNT, span order and caret geometry (both measured per span) are
     * untouched, and `word`/`typed` — everything the engine sees — stay
     * canonical. It never rides an extra (over-typed) letter: extras are typed
     * content, and decorating them would put the canary at a position that
     * depends on the player's own mistakes instead of on the seed.
     */
    canary?: Canary | null
    /**
     * Text an IME is composing right now, rendered over the letters that follow
     * `typed`. Never state: the player has typed nothing until the session ends,
     * so a composed character is drawn "dead" — visible, marked correct when it
     * already matches the target, but never counted as a mistake and never
     * making the word error underline appear. Only the ACTIVE word receives it.
     */
    composing?: string
  }
  const props = defineProps<Props>()

  type LetterState = '' | 'correct' | 'incorrect' | 'extra' | 'missed'

  /**
   * Tab and newline are real characters of a code/quote target, so they must
   * render as a measurable box the caret can sit on — as a dimmed glyph, the way
   * monkeytype draws its `tabChar`/`nlChar` letters.
   */
  const GLYPHS: Record<string, string> = { '\t': '→', '\n': '↵' }
  const display = (char: string): string => GLYPHS[char] ?? char

  interface Letter {
    display: string
    state: LetterState
    ws: boolean
    tab: boolean
    /** An IME's in-flight character: shown, but not yet typed by anyone. */
    dead?: boolean
  }

  const letters = computed<Letter[]>(() => {
    const target = props.word
    const typed = props.typed
    const blind = props.blind === true
    const committed = props.committed === true
    const canary = props.canary ?? null
    // Split by code point: a composed candidate can be outside the BMP.
    const composing = [...(props.composing ?? '')]
    const out: Letter[] = []

    for (let i = 0; i < target.length; i++) {
      let state: LetterState = ''
      let dead = false
      let glyph = target[i]
      if (i < typed.length)
        state = blind ? 'correct' : typed[i] === target[i] ? 'correct' : 'incorrect'
      else if (i - typed.length < composing.length) {
        // Composed characters replace the letters they sit on. Marked correct
        // when they already match, never incorrect: the session can still change
        // its mind — a pinyin buffer becomes a hanzi in one update.
        glyph = composing[i - typed.length]
        dead = true
        if (!blind && glyph === target[i]) state = 'correct'
      }
      // Untyped letters of a committed word are "missed"; on the active word they are
      // simply not-yet-typed. Blind hides both.
      else if (committed && !blind) state = 'missed'
      // The canary trails the letter BEFORE its slot, so scraped text carries
      // it at offset `slot`. Text content only — never a new span.
      const trailer = canary !== null && i === canary.slot - 1 ? canary.grapheme : ''
      out.push({
        display: display(glyph) + trailer,
        state,
        ws: target[i] in GLYPHS,
        tab: target[i] === '\t',
        dead
      })
    }
    // Extra characters typed past the target length (neutral under blind).
    for (let i = target.length; i < typed.length; i++) {
      out.push({
        display: display(typed[i]),
        state: blind ? 'correct' : 'extra',
        ws: typed[i] in GLYPHS,
        tab: typed[i] === '\t'
      })
    }
    // A composition running past the end of the target: same "dead" treatment,
    // not `extra` — nothing has been typed, so nothing is over-typed yet.
    for (let i = Math.max(target.length, typed.length) - typed.length; i < composing.length; i++) {
      out.push({
        display: display(composing[i]),
        state: '',
        ws: composing[i] in GLYPHS,
        tab: composing[i] === '\t',
        dead: true
      })
    }
    return out
  })

  // A committed (or active) word with any wrong / missed / extra letter is errored.
  const hasError = computed(
    () =>
      props.blind !== true &&
      (props.committed === true || props.active) &&
      letters.value.some(
        (l) => l.state === 'incorrect' || l.state === 'extra' || l.state === 'missed'
      )
  )

  // Test seam: when a perf test opts in (`globalThis.__wordUpdates = 0`), count how
  // many Word components re-render per keystroke (expected ≤ 2). No-op otherwise.
  onUpdated(() => {
    const hook = globalThis as { __wordUpdates?: number }
    if (typeof hook.__wordUpdates === 'number') hook.__wordUpdates += 1
  })
</script>
