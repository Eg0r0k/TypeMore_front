<template>
  <div
    class="game"
    :class="{ 'right-to-left': isRightToLeft, 'game--unfocused': showFocusHint }"
    @mousedown.prevent="focusInput"
  >
    <TestInput
      v-if="session && hasWords"
      ref="inputRef"
      :store="session"
      @focus="typingFocused = true"
      @blur="typingFocused = false"
    />
    <div v-if="showFocusHint" class="game__focus-hint" aria-hidden="true">
      press any key to type
    </div>
    <div ref="viewportRef" class="game__viewport w-full">
      <div ref="hostRef" class="game__host"></div>
    </div>

    <Teleport v-if="shadowContainer" :to="shadowContainer">
      <div
        ref="wordsRef"
        class="game__words"
        :class="{ 'game__words--tape': tape, 'tm-fading': fading, 'tm-flashlight': flashlight }"
        :style="[wordsStyle, modStyle]"
      >
        <div
          v-if="caretVisible && caretStyle !== 'off'"
          class="game__caret"
          :class="`game__caret--${caretStyle}`"
          :style="caretBoxStyle"
        />
        <div
          v-for="ghost in ghostPositions"
          :key="ghost.id"
          class="game__ghost-caret"
          :class="{
            'game__ghost-caret--label-below': ghost.labelBelow,
            'game__ghost-caret--label-left': ghost.labelLeft
          }"
          :style="{
            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
            height: `${ghost.height}px`,
            // A paced ghost travels for exactly the time it has; a relayed one
            // leaves these unset and keeps the field's default transition.
            ...(ghost.glideMs === undefined
              ? {}
              : { '--tm-ghost-ms': `${ghost.glideMs}ms`, '--tm-ghost-ease': 'linear' })
          }"
        >
          <!-- No label for a nameless ghost: a pace bot is nobody — not even
               the player themselves — so only real opponents carry a nick. -->
          <span v-if="ghost.label" class="game__ghost-caret-label">{{ ghost.label }}</span>
        </div>
        <!-- A word plus its optional line breaker are ONE loop item, so the
             breaker is dropped together with its word when the window scrolls.
             v-memo on the <template v-for> is honoured (it compiles to
             withMemo/isMemoSame); eslint's rule just does not know the directive. -->
        <!-- eslint-disable vue/no-useless-template-attributes -->
        <template
          v-for="item in windowItems"
          :key="item.index"
          v-memo="[
            item.word,
            typedFor(item.index),
            item.index === store.wordIndex,
            item.index < store.wordIndex,
            store.blind,
            item.canaryKey
          ]"
        >
          <TestWord
            :word="item.word"
            :typed="typedFor(item.index)"
            :active="item.index === store.wordIndex"
            :committed="item.index < store.wordIndex"
            :blind="store.blind"
            :canary="item.canary"
          />
          <div v-if="item.breaksLine" class="line-break" aria-hidden="true"></div>
        </template>
        <!-- eslint-enable vue/no-useless-template-attributes -->
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { useEventListener, useResizeObserver } from '@vueuse/core'

  import { TestWord } from '@/features/test/word'
  import { TestInput } from '@/features/test/input'
  import { type Canary, canaryAt } from '@typemore/core'
  import { wordBreaksLine, wordsHaveNewline, wordsHaveTab } from '@entities/game'
  import type { GameSession, GameView } from '@entities/game'
  import { useCaret } from '@/shared/lib/hooks/useCaret'
  import { useGhostCarets, type TestGhostCaret } from '@/shared/lib/hooks/useGhostCarets'
  import { useLineJump } from '@/shared/lib/hooks/useLineJump'
  import { useScrollTape } from '@/shared/lib/hooks/useScrollTape'
  import { WORDS_SHADOW_STYLES, FADE_MS, SMOOTH_CARET_MS } from './game-styles'
  import type { CaretStyle, SmoothCaret } from '@/shared/constants/type'
  /**
   * Pure view over a `GameView`: renders the windowed words + caret in a shadow
   * root and forwards keystrokes via the hidden input. It owns NO session
   * lifecycle — word generation, config-driven rebuilds, the timer and Esc-restart
   * live in the page (see the home page), so the field can be unmounted for the
   * results screen and remounted on restart without losing the session. Anything
   * satisfying `GameView` renders: the local session, a ghost driver's view-model,
   * or a hand-built reactive object in tests. `blind` arrives through the view —
   * the field never reads app config.
   */
  interface Props {
    store: GameView
    isRightToLeft?: boolean
    tape?: boolean
    /** Fading view mod: the active word melts over FADE_MS (CSS-only). */
    fading?: boolean
    /** Flashlight view mod: mask all but the active word ± neighbours (CSS mask at the caret). */
    flashlight?: boolean
    /** Shadow root mode; defaults to open in dev/test, closed in prod. */
    shadowMode?: 'open' | 'closed'
    /** Replay/ghost mode: render the store's state but mount no input adapter. */
    viewOnly?: boolean
    /**
     * Input lockout (match countdown): the field stays live — words, ghosts,
     * focus hint suppressed — but no input adapter is mounted, so keystrokes
     * produce neither state changes nor sound feedback. When it flips back off
     * the adapter mounts AND arms itself, so the first real keystroke types.
     */
    inputDisabled?: boolean
    /** Racing-style opponent carets rendered inside this field (ghost cars on the local track). */
    ghosts?: readonly TestGhostCaret[]
    /** Caret shape; `off` renders no caret at all. Driven by app config from the page. */
    caretStyle?: CaretStyle
    /** How far the caret interpolates between letters; `off` snaps. */
    smoothCaret?: SmoothCaret
    /**
     * The run's seed, when the page wants display canaries (@typemore/core
     * canary.ts) woven into the rendered words. `null` (the default) renders a
     * clean field — replays, ghosts, tests and custom runs stay canary-free —
     * and a `viewOnly` field ignores the prop unconditionally: it renders
     * someone ELSE's run, whose canary schedule belongs to their seed and
     * whose text is already public.
     */
    canarySeed?: number | null
  }
  const props = withDefaults(defineProps<Props>(), {
    isRightToLeft: false,
    tape: false,
    viewOnly: false,
    inputDisabled: false,
    shadowMode: import.meta.env.PROD ? 'closed' : 'open',
    fading: false,
    flashlight: false,
    caretStyle: 'default',
    smoothCaret: 'medium',
    canarySeed: null
  })

  const store = props.store
  // A non-viewOnly field REQUIRES an input-capable session (the local player).
  // Ghost/replay callers always pass viewOnly, so the cast never observes a pure
  // GameView; the type system can't tie the two props together across a template.
  const session = computed(() =>
    props.viewOnly || props.inputDisabled ? null : (props.store as GameSession)
  )
  /**
   * A field with no words is not a game: the session was never set up (the
   * dictionary failed to load, or the page has not generated words yet). Mount
   * no input adapter and capture no keys — otherwise the hidden textarea owns
   * the keyboard and the player types into an empty screen.
   */
  const hasWords = computed(() => store.words.length > 0)

  const inputRef = ref<InstanceType<typeof TestInput> | null>(null)
  const viewportRef = ref<HTMLElement | null>(null)
  const wordsRef = ref<HTMLElement | null>(null)
  const hostRef = ref<HTMLElement | null>(null)
  const shadowContainer = ref<HTMLElement | null>(null)

  const typedFor = (i: number): string => store.snapshot.input[i] ?? ''
  const wordIndexRef = computed(() => store.wordIndex)
  const caretIndexRef = computed(() => store.snapshot.input[store.wordIndex]?.length ?? 0)

  const WINDOW_AHEAD = 60
  const {
    start: windowStart,
    rebalance: rebalanceWindow,
    reset: resetWindow
  } = useLineJump(wordsRef)
  const { offsetX, update: updateTape } = useScrollTape(wordsRef, wordIndexRef)
  const {
    x: caretX,
    y: caretY,
    width: caretWidth,
    height: caretHeight,
    visible: caretVisible,
    update: updateCaret,
    invalidate: invalidateCaret
  } = useCaret(wordsRef, caretIndexRef)
  // Ghost carets: a viewOnly field (someone else's replay) never renders them.
  const ghostList = computed<readonly TestGhostCaret[]>(() =>
    props.viewOnly ? [] : (props.ghosts ?? [])
  )
  const {
    positions: ghostPositions,
    update: updateGhosts,
    invalidate: invalidateGhosts
  } = useGhostCarets(wordsRef, ghostList, windowStart)

  // The seed the canary schedule reads: the page's, unless this field is a
  // viewOnly surface (replays/ghosts render other people's runs — see the prop).
  const canarySeed = computed(() => (props.viewOnly ? null : (props.canarySeed ?? null)))

  // Windowed (recycled) slice keyed by ABSOLUTE index — bounded node count for 10k words.
  // `breaksLine` rides along so a code/quote word that ends a line gets its
  // full-width breaker sibling (see .line-break in game-styles); tape mode is one
  // nowrap row, so it never breaks.
  //
  // `canary` is computed here — per WINDOWED word, not per keystroke: the object
  // itself is fresh on every recompute, so what v-memo watches is `canaryKey`, a
  // primitive that survives recomputes (Object.is over a fresh object would void
  // the memo and re-render every word on every commit). The key must be in the
  // memo array: a restart can reuse the same word at the same index under a NEW
  // seed, and word+typed+flags would all compare equal — only the canary moved.
  const windowItems = computed(() => {
    const words = store.words
    const seed = canarySeed.value
    const to = Math.min(words.length, store.wordIndex + WINDOW_AHEAD)
    const items: {
      word: string
      index: number
      breaksLine: boolean
      canary: Canary | null
      canaryKey: string
    }[] = []
    for (let i = windowStart.value; i < to; i++) {
      const canary = seed === null ? null : canaryAt(seed, i, words[i])
      items.push({
        word: words[i],
        index: i,
        breaksLine: !props.tape && wordBreaksLine(words[i]),
        canary,
        canaryKey: canary === null ? '' : `${canary.slot}:${canary.grapheme}`
      })
    }
    return items
  })

  const wordsStyle = computed(() =>
    props.tape ? { transform: `translate3d(${-offsetX.value}px, 0, 0)` } : {}
  )
  // View-mod CSS vars: fade duration + flashlight mask centre. Vars only — no
  // layout reads (the caret geometry is already tracked), styles live in the shadow.
  const modStyle = computed<Record<string, string>>(() => {
    const style: Record<string, string> = {}
    if (props.fading) style['--tm-fade-ms'] = `${FADE_MS}ms`
    if (props.flashlight) {
      style['--tm-fl-x'] = `${caretX.value}px`
      style['--tm-fl-y'] = `${caretY.value + caretHeight.value / 2}px`
    }
    return style
  })
  // Caret geometry travels as CSS vars: the shadow styles own the SHAPE (bar,
  // block, outline, underline), this only says where it is, how tall/wide the
  // letter under it is, and how long the move may take.
  const caretBoxStyle = computed<Record<string, string>>(() => ({
    transform: `translate(${caretX.value}px, ${caretY.value}px)`,
    '--tm-caret-h': `${caretHeight.value}px`,
    '--tm-caret-w': `${caretWidth.value}px`,
    '--tm-caret-ms': `${SMOOTH_CARET_MS[props.smoothCaret]}ms`
  }))

  const focusInput = (): void => inputRef.value?.focus()

  /**
   * Focus capture, monkeytype-style (event-handlers/global.ts): the typing
   * surface is a 1px hidden textarea, so ANY click elsewhere silently disarms the
   * game — you type and nothing happens. A key pressed anywhere on the page
   * re-arms it instead, and that first key is swallowed (never typed twice, and
   * Space cannot scroll the page). Ignored: modifier combos, the app's own
   * shortcuts (Escape, and Enter/Tab unless the run types them), keys aimed at a
   * real editable element (chat, search) and anything typed while a dialog is open.
   */
  const typingFocused = ref(false)
  const showFocusHint = computed(
    () => session.value !== null && hasWords.value && !typingFocused.value
  )

  // Tab and Enter are typing keys only for a word list that carries them (code
  // snippets, quotes) — mirrors monkeytype's `wordsHaveTab()` / `wordsHaveNewline()`
  // gates. Anywhere else they stay browser/app keys and never re-arm the field.
  const typesTab = computed(() => wordsHaveTab(store.words))
  const typesNewline = computed(() => wordsHaveNewline(store.words))

  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  }

  /**
   * Something modal owns the keyboard — a dialog, or a popover (reka gives both
   * `role="dialog"`). Two paths have to honour it, not one: re-arming on a
   * keypress obviously, but ALSO the rebuild below. A settings change rebuilds
   * the run, and arming the field from inside that rebuild yanks focus out of
   * the panel the change was made in, which dismisses it on focus-outside — so
   * toggling a second mod would mean opening the panel again.
   */
  const modalIsOpen = (): boolean => document.querySelector('[role="dialog"]') !== null

  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (session.value === null || !hasWords.value || typingFocused.value) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') return
    // Printable (one grapheme), the correction key, or a layout key this run
    // actually types — everything else is navigation.
    const typesThisKey =
      event.key === 'Backspace' ||
      [...event.key].length === 1 ||
      (event.key === 'Enter' && typesNewline.value) ||
      (event.key === 'Tab' && typesTab.value)
    if (!typesThisKey) return
    if (isEditableTarget(event.target)) return
    if (modalIsOpen()) return
    focusInput()
    event.preventDefault()
  })

  // Ordering contract for a correct line jump: commit -> render -> read geometry
  // -> decide the shift. Store watchers flush BEFORE this component re-renders, so
  // we await nextTick first; only then does `.word.active` mark the NEW active word
  // and its offsetTop reflect the settled layout. Reading geometry before that
  // render compares against the stale layout and lags the window shift by one
  // commit (the active word slips onto the third line). A second nextTick lets any
  // dropped lines re-render before the caret is measured against the final DOM.
  async function applyGeometry(): Promise<void> {
    await nextTick()
    if (props.tape) updateTape()
    else rebalanceWindow()
    await nextTick()
    invalidateCaret()
    updateCaret()
  }

  // Ghost geometry stays OFF the local keystroke path: a keystroke that does
  // not shift the window never measures ghosts. Re-measures happen only on
  // ghost-prop changes (per-ghost cache-gated) and on true layout changes —
  // window shift, resize, font load, words reset — via this invalidating pass.
  async function applyGhostGeometry(): Promise<void> {
    await nextTick()
    invalidateGhosts()
    updateGhosts()
  }

  // Words render inside a shadow root (anti-scrape layer 1): closed in prod, open in
  // dev/test. Scoped styles do not cross the boundary, so the words CSS is injected
  // here. Nothing about the root or core is exposed on `window`.
  function mountShadow(): void {
    const host = hostRef.value
    if (!host) return
    const mode = props.shadowMode ?? (import.meta.env.DEV ? 'open' : 'closed')
    const root = host.attachShadow({ mode })
    const style = document.createElement('style')
    style.textContent = WORDS_SHADOW_STYLES
    root.appendChild(style)
    const container = document.createElement('div')
    root.appendChild(container)
    shadowContainer.value = container
  }

  onMounted(async () => {
    mountShadow()
    await nextTick() // Teleport mounts the words container into the shadow root
    // Same rule as the rebuild below: a settings change swaps this component out
    // and back (the page shows its loading notice in between), so the mount is
    // ALSO a path that would arm the field from under an open panel.
    if (hasWords.value && !modalIsOpen()) focusInput()
    await applyGeometry()
    updateGhosts()
    document.fonts?.ready.then(() => {
      void applyGeometry()
      void applyGhostGeometry()
    })
  })

  useResizeObserver(viewportRef, () => {
    void applyGeometry()
    void applyGhostGeometry()
  })

  // Geometry reacts to the active word itself, not only to wordIndex: on commit the
  // active word advances, but extra characters also widen the current word and
  // flex-wrap can push it onto a new line mid-word. caretIndexRef tracks that
  // growth, so watching both keeps the active word off the third line in either
  // case. Both refs change together on commit, so applyGeometry runs once per edit.
  watch([wordIndexRef, caretIndexRef], ([index]) => {
    /*
     * The window only ever ADVANCES — `rebalance` drops whole lines above the
     * active one and never gives them back — so a jump backwards past its start
     * leaves a slice that no longer contains the active word. The rendered range
     * is `[start .. index + WINDOW_AHEAD]`, so with `start` past that end it is
     * EMPTY, and an empty field has no `.word` for the next rebalance to measure:
     * the view is stuck showing the tail of the text for good. That is a replay
     * restarting (`driver.reset()` keeps the same words array, so the words
     * watcher below never fires), and it bites hardest on a text with newlines,
     * where the short lines mean many were dropped.
     */
    if (index < windowStart.value) resetWindow()
    void applyGeometry()
  })
  // The match field arms LATE: during the countdown `inputDisabled` keeps the
  // adapter unmounted, and the session appears only on GO. Focus it the moment
  // it exists — otherwise the first real keystroke is spent re-arming the field.
  watch(session, async (now) => {
    if (now === null || !hasWords.value || modalIsOpen()) return
    await nextTick()
    focusInput()
  })
  // A window shift (line jump) moves every rendered word — re-anchor the ghosts.
  watch(windowStart, () => void applyGhostGeometry())
  // Ghost prop churn (relay batches): cache-gated update, no invalidation.
  watch(ghostList, () => updateGhosts(), { flush: 'post' })
  watch(
    () => store.words,
    async () => {
      resetWindow()
      void applyGeometry()
      void applyGhostGeometry()
      // Words arriving late (first setup, or a retry after a failed load) mount
      // the input adapter only now — arm it once it exists, unless a panel is
      // open (see `modalIsOpen`): the next keypress arms it instead.
      if (!hasWords.value || modalIsOpen()) return
      await nextTick()
      focusInput()
    }
  )

  defineExpose({ focusInput })
</script>

<style lang="scss" scoped>
  .game {
    position: relative;
    width: 100%;

    &.right-to-left {
      direction: rtl;
    }
  }

  // Out-of-focus state: the field is a hidden 1px input, so "nothing happens"
  // needs an explanation. The hint sits above the words and disappears the
  // moment the field is armed again.
  .game__focus-hint {
    position: absolute;
    top: -1.75rem;
    left: 0;
    z-index: 5;
    font-size: 0.8rem;
    color: var(--sub-color);
    pointer-events: none;
  }

  .game__viewport {
    // Exactly three rows of the words grid: row = line box (32px × 1.6) + the
    // 2px underline slot, no vertical margin (see game-styles.ts).
    height: 160px;
    overflow: hidden;
  }

  .game__host {
    display: block;
    width: 100%;
  }
</style>
