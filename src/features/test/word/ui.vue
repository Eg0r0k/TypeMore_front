<template>
  <div class="word" :class="{ active: props.active, 'word--error': hasError }">
    <span
      v-for="(letter, i) in letters"
      :key="i"
      class="letter"
      :class="[letter.state, { 'letter--ws': letter.ws, 'letter--tab': letter.tab }]"
    >
      {{ letter.display }}
    </span>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onUpdated } from 'vue'

  /**
   * One component per word (never per letter). Letters are keyed `<span>`s whose
   * class comes from a pure `(target, typed, committed) -> state[]` derivation —
   * no innerHTML rebuild. The parent applies `v-memo` keyed on
   * `[word, typed, active, committed, blind]`, so a word re-renders exactly when
   * something it displays changes (including on commit, when `active`/`committed` flip).
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

  const letters = computed<{ display: string; state: LetterState; ws: boolean; tab: boolean }[]>(() => {
    const target = props.word
    const typed = props.typed
    const blind = props.blind === true
    const committed = props.committed === true
    const out: { display: string; state: LetterState; ws: boolean; tab: boolean }[] = []

    for (let i = 0; i < target.length; i++) {
      let state: LetterState = ''
      if (i < typed.length)
        state = blind ? 'correct' : typed[i] === target[i] ? 'correct' : 'incorrect'
      // Untyped letters of a committed word are "missed"; on the active word they are
      // simply not-yet-typed. Blind hides both.
      else if (committed && !blind) state = 'missed'
      out.push({
        display: display(target[i]),
        state,
        ws: target[i] in GLYPHS,
        tab: target[i] === '\t'
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
