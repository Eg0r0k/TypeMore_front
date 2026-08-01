<template>
  <textarea
    ref="inputRef"
    class="game-input"
    aria-label="Type here"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    :rows="1"
    @beforeinput="onBeforeInput"
    @compositionstart="onCompositionStart"
    @compositionupdate="onCompositionUpdate"
    @compositionend="onCompositionEnd"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @paste="onPaste"
    @focus="emit('focus')"
    @blur="emit('blur')"
  />
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'

  import { wordsHaveTab, type GameSession } from '@entities/game'
  import { isSpaceGrapheme, normalizeGrapheme } from '@typemore/core'
  import { useSounds } from '@/shared/lib/hooks/useSounds'
  import { useConfigStore } from '@/entities/config'
  import { getSoundPack } from '@/shared/constants/sound-packs'

  /**
   * Hidden keystroke-capture surface. The DOM value is NEVER the source of truth:
   * every mutation is prevented and translated into a core event, so the reducer
   * state is the only truth.
   *
   * THE ONE EXCEPTION, AND IT IS NOT OPTIONAL: while an IME composition session
   * is open the textarea is a temporary scratch buffer, force-cleared on
   * `compositionend`. `preventDefault()` on `insertCompositionText` is ignored by
   * every engine, so the DOM mutates whether we consent or not; the choice is
   * between reconciling that and pretending it does not happen. Pretending is
   * what produced the mobile bug — Android drives PLAIN LATIN through
   * composition, so a tap on a keyboard suggestion typed nothing into the store,
   * left the word judged wrong, and stranded the suggestion's trailing space in
   * the textarea as an invisible character. The scratch buffer is never read:
   * what reaches the store is `compositionend`'s own `data`.
   *
   * Contract:
   *  - `insert` carries strictly ONE grapheme per keystroke; any multi-character
   *    input (autocomplete, mobile suggestion) is routed through `replace`.
   *  - Paste → `preventDefault` + `replace` with `source: 'paste'`.
   *  - A composition session dispatches NOTHING while it runs and EXACTLY ONE
   *    `replace(..., 'ime')` when it ends. Granularity is therefore the session,
   *    which on Android is about one word: per-character timing inside a composed
   *    word is coarsened, and that is an accepted v1 limitation — diffing
   *    `compositionupdate` to synthesise keystrokes would invent timings the
   *    player never produced.
   *  - No async, no side-effecting store getters on this path — stamp + dispatch only.
   */
  const props = defineProps<{ store: GameSession }>()
  const store = props.store

  const emit = defineEmits<{
    (event: 'focus'): void
    (event: 'blur'): void
    /**
     * The text an IME is currently composing, '' when no session is open. The
     * field renders it over the active word; it is NOT game state — it never
     * reaches the store, the log or the reducer, because until the session ends
     * the player has not typed anything.
     */
    (event: 'composition', text: string): void
  }>()

  const inputRef = ref<HTMLTextAreaElement | null>(null)

  /** In-flight composed text. Deduped so a repeated update costs no render. */
  const compositionText = ref('')
  const setCompositionText = (text: string): void => {
    if (compositionText.value === text) return
    compositionText.value = text
    emit('composition', text)
  }

  const caretPos = (): number => store.snapshot.input[store.wordIndex]?.length ?? 0

  // Audio feedback. The pack's click samples play on a correct grapheme, the
  // error sample on a wrong one; both gated by `config.playSound` inside the
  // hook. Correctness of a single keystroke is trivially the typed grapheme vs
  // the expected one at the caret, so it's read here, not in the store/core.
  // The pack is bound at mount: changing it in settings applies on the next
  // visit to the typing screen (this adapter remounts on route change).
  const config = useConfigStore().config
  const pack = getSoundPack(config.soundSet)
  const { playRandomClickSound, playErrorSound } = useSounds([...pack.click], pack.error)

  const playKeyFeedback = (grapheme: string): void => {
    // Blind hides correctness, and the sounds are part of the view: the error
    // sample would leak the very signal the mod masks, so under blind every
    // keystroke clicks like a correct one.
    if (store.blind) {
      playRandomClickSound()
      return
    }
    const expected = [...(store.words[store.wordIndex] ?? '')][caretPos()]
    if (grapheme === expected) playRandomClickSound()
    else playErrorSound()
  }

  // A code/quote word list carries its layout in the words themselves: `\t` for
  // indentation, `\n` at the end of the word that closes a line. Tab only becomes
  // a typing key when the run actually contains one (monkeytype gates the same way
  // behind `wordsHaveTab()`); otherwise it stays the browser's focus key.
  const typesTab = computed(() => wordsHaveTab(store.words))

  /**
   * Enter separates words exactly like space does; when the target expects a
   * newline at the caret, the character is typed first so it counts as the
   * keystroke it is (monkeytype's `getCommitCharacterType`: '\n' IS a separator).
   *
   * But ONLY a target-final newline separates. `generateWords` splits a quote's
   * text on spaces, so a code quote's newline usually lands mid-token
   * (`{\n\ttext-align:` — 241 of code_css's 376 tokens carry one). Committing
   * there would throw the rest of the token away and jump the player to the next
   * word with the remainder of the line silently marked missed — the reported
   * word skip. Inside a token the newline is simply one of its characters, which
   * is already exactly how the reducer treats it.
   */
  const separateWord = (): void => {
    const target = store.words[store.wordIndex] ?? ''
    const at = caretPos()
    if (target[at] === '\n') {
      playKeyFeedback('\n')
      store.insert('\n')
      if (at < target.length - 1) return
    }
    store.commit()
  }

  /**
   * A space keystroke SEPARATES — unless the target expects a space variant at
   * the caret, in which case that space IS the next character and is typed.
   *
   * Same shape as `separateWord` above, and for the same reason: a target is one
   * box, so a space inside one is an ordinary character the reducer already
   * compares like any other. Both target sources produce such words.
   * `generateWords` splits a quote on U+0020 alone, so every OTHER space variant
   * stays inside its token — 12 of the 15 817 vendored quotes carry a U+00A0 or
   * U+202F (russian #1199 is `Молодость!<NBSP>-`). A dictionary token may hold a
   * plain U+0020 outright: 11 858 words across 68 published dictionaries are
   * multi-word (`else if`, `vor allem`, `use strict`).
   *
   * Routing those to `commit()` unconditionally made them untypeable, and under
   * `nospace` that is not merely a missed character. There `commit` is REFUSED
   * (`NospaceCommit`, game-core.ts), so the caret stayed on the space while the
   * following keystrokes filled the target's LENGTH and auto-committed the word
   * with the wrong content — every later word then ran out of phase, which is
   * the "nospace did nothing on this quote" report.
   *
   * `normalizeGrapheme` stores the EXPECTED variant, so the log carries the
   * target's own byte (the U+00A0, not the U+0020 that was pressed) and core,
   * replay and `validateLog` keep comparing with plain `===`.
   */
  const separateOrTypeSpace = (typed: string): void => {
    const target = store.words[store.wordIndex] ?? ''
    const expected = target[caretPos()]
    if (expected !== undefined && isSpaceGrapheme(expected)) {
      const grapheme = normalizeGrapheme(typed, expected, config.language)
      playKeyFeedback(grapheme)
      store.insert(grapheme)
      return
    }
    store.commit()
  }

  // ── IME composition ────────────────────────────────────────────────────────

  /** A session is open: `compositionstart` arrived and nothing has settled it. */
  let composing = false
  /**
   * Caret position when the session opened. The buffer cannot move while a
   * session runs (we dispatch nothing), so this equals the caret at the end —
   * but the range is what a composition REPLACES, and saying so costs one field
   * and survives anything that ever does dispatch mid-session.
   */
  let compositionAnchor = 0
  /**
   * This session already produced its `replace`. Set by whichever end runs
   * first — ours (quick-end) or the browser's — so the second one is a no-op.
   * Without it, quick-end doubles every last word in the log.
   */
  let compositionSettled = false

  /** Drop whatever the browser wrote into the scratch buffer during a session. */
  const clearScratch = (): void => {
    const element = inputRef.value
    if (element !== null && element.value !== '') element.value = ''
  }

  /**
   * Apply composed text to `[from, to)` as ONE `replace`, then let any trailing
   * space take the ordinary separator path.
   *
   * The split is what keeps a mobile suggestion honest. Android commits `hello `
   * — word plus separator in one string — and storing that verbatim would put a
   * space INSIDE the word buffer, where it is a character the target does not
   * have: the word reads wrong and the space is the "invisible character" the
   * player then has to backspace away. Routed through `separateOrTypeSpace` it
   * commits the word instead, or types itself when the target really does expect
   * a space there.
   */
  const applyComposedText = (from: number, to: number, text: string): void => {
    const graphemes = [...text]
    let end = graphemes.length
    while (end > 0 && isSpaceGrapheme(graphemes[end - 1])) end--
    const body = graphemes.slice(0, end).join('')
    if (body !== '') store.replace(from, to, body, 'ime')
    // Each trailing space separates in its own right, exactly as pressing it would.
    for (const space of graphemes.slice(end)) separateOrTypeSpace(space)
  }

  /**
   * Settle the session. Called by the browser's `compositionend` and by
   * quick-end; the first caller wins and the second only cleans up.
   *
   * Empty `data` is a CANCELLED composition (Escape, candidate window dismissed)
   * — nothing was typed, so nothing is logged.
   */
  const endComposition = (data: string): void => {
    composing = false
    setCompositionText('')
    clearScratch()
    if (compositionSettled) return
    compositionSettled = true
    if (data === '') return
    const to = caretPos()
    applyComposedText(Math.min(compositionAnchor, to), to, data)
  }

  const onCompositionStart = (): void => {
    composing = true
    compositionSettled = false
    compositionAnchor = caretPos()
    setCompositionText('')
  }

  /**
   * `data` is the WHOLE composed string so far, never a delta — a Japanese
   * candidate swap replaces `いえ` with `家` outright — so it is assigned, not
   * appended.
   */
  const onCompositionUpdate = (event: CompositionEvent): void => {
    if (!composing) return
    const data = event.data ?? ''
    setCompositionText(data)
    quickEnd(data)
  }

  const onCompositionEnd = (event: CompositionEvent): void => {
    endComposition(event.data ?? '')
  }

  /**
   * Close the session ourselves once the LAST word is complete (monkeytype's
   * composition quick end, `input/listeners/input.ts`). An IME holds its session
   * open until the player types past it or confirms; on the final word there is
   * nothing left to type, so the run would sit finished-but-unsettled waiting for
   * a keystroke that never comes.
   *
   * Settled directly rather than by dispatching a synthetic `CompositionEvent`:
   * a synthetic event is untrusted, so no IME reacts to it either way, and the
   * direct call is one code path instead of two. The browser's own
   * `compositionend` still arrives afterwards and is absorbed by
   * `compositionSettled`.
   */
  const quickEnd = (data: string): void => {
    if (store.wordIndex < store.words.length - 1) return
    const target = store.words[store.wordIndex] ?? ''
    const buffer = store.snapshot.input[store.wordIndex] ?? ''
    if (buffer + data !== target) return
    endComposition(data)
  }

  /**
   * Log v2 keystroke telemetry: the PHYSICAL key stream (`KeyboardEvent.code`),
   * captured alongside the text path through the same stamping pipeline, so a
   * `down` is stamped before the `insert` it produces (DOM order: keydown →
   * beforeinput) and the matching `up` after it. Rules:
   *  - composition sessions are suppressed entirely (no half-captured IME
   *    noise) — `isComposing` covers both halves;
   *  - auto-repeat `keydown`s (`event.repeat`) are skipped: telemetry records
   *    physical presses and releases, and a held key is exactly one pair;
   *  - modifiers are captured like any key (a Shift hold IS the signal);
   *  - empty `code` (some synthetic/virtual sources) records nothing.
   * The store drops these on a v1 run, so no capability check happens here.
   */
  const onTelemetryDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.repeat || event.code === '') return
    store.keyDown?.(event.code)
  }

  const onKeyup = (event: KeyboardEvent): void => {
    if (event.isComposing || event.code === '') return
    store.keyUp?.(event.code)
  }

  const onKeydown = (event: KeyboardEvent): void => {
    onTelemetryDown(event)
    if (event.isComposing) return // composition unsupported: ignore
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      separateOrTypeSpace(' ')
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      separateWord()
      return
    }
    // Shift+Tab is left to the browser so the page stays keyboard-navigable.
    if (event.key === 'Tab' && !event.shiftKey && typesTab.value) {
      event.preventDefault()
      playKeyFeedback('\t')
      store.insert('\t')
      return
    }
    if (event.key === 'Backspace') {
      event.preventDefault()
      store.deleteBackward(event.ctrlKey || event.altKey ? 'word' : 'char')
    }
  }

  const onBeforeInput = (event: InputEvent): void => {
    const type = event.inputType

    // Composition. NOT cancelled while `isComposing` — the engines ignore that
    // anyway, and fighting it is what desynced the buffer from the DOM. The one
    // composition-typed event worth cancelling is the stray Firefox fires after
    // the session is over (and the trailing `insertFromComposition` Chrome emits
    // on the same edge): the session is already settled, so letting it through
    // would only refill the scratch buffer we just cleared.
    if (type === 'insertCompositionText' || type === 'insertFromComposition') {
      if (!event.isComposing) {
        event.preventDefault()
        clearScratch()
      }
      return
    }

    // A suggestion or autocorrect applied OUTSIDE a session: the browser hands
    // over the whole replacement in one event. It rewrites the word under the
    // caret, which is exactly this word's buffer, so the range is the buffer.
    if (type === 'insertReplacementText') {
      event.preventDefault()
      applyComposedText(0, caretPos(), event.data ?? '')
      return
    }

    if (type === 'insertText') {
      event.preventDefault()
      const data = event.data ?? ''
      const graphemes = [...data]
      if (graphemes.length === 1) {
        // Any typable space variant (soft keyboards and IMEs emit them as
        // insertText with no keydown — U+3000 and friends) separates the word
        // exactly like the space key above, and types itself on the same rule
        // when the target expects a space there.
        if (isSpaceGrapheme(data)) {
          separateOrTypeSpace(data)
          return
        }
        // Visual equivalence (shared/core/normalize): a typed grapheme that IS
        // the expected character in another skin — '-' for '—', 'е' for 'ё' —
        // is stored AS the expected one. This is the pre-event normalization
        // the log contract (events.ts) requires: the stored text is final, so
        // reducer, metrics and the server all keep comparing with plain `===`.
        const expected = [...(store.words[store.wordIndex] ?? '')][caretPos()]
        const grapheme = normalizeGrapheme(data, expected, config.language)
        // Feedback first: caretPos() must read the pre-insert position.
        playKeyFeedback(grapheme)
        store.insert(grapheme)
      }
      // Multi-character text insertion is never emitted as a multi-grapheme insert.
      else if (graphemes.length > 1) store.replace(caretPos(), caretPos(), data, 'ime')
      return
    }

    // Soft keyboards emit the line break without a keydown — same rule as Enter.
    if (type === 'insertLineBreak' || type === 'insertParagraph') {
      event.preventDefault()
      separateWord()
      return
    }

    // Everything else (composition, paste, deletes, formatting) is handled
    // elsewhere or unsupported: block the DOM mutation so it can't leak in.
    event.preventDefault()
  }

  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault()
    const text = event.clipboardData?.getData('text') ?? ''
    if (text.length > 0) store.replace(caretPos(), caretPos(), text, 'paste')
  }

  /**
   * `preventScroll` matters: this element is a 1px box parked in the layout, and
   * a plain focus() would scroll the page to it — jumping the view every time the
   * field re-arms itself (monkeytype does the same, input/input-element.ts).
   */
  defineExpose({ focus: () => inputRef.value?.focus({ preventScroll: true }) })
</script>

<style lang="scss" scoped>
  .game-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    opacity: 0;
    // Kept in the layout (not display:none) so it can hold focus and emit events.
    resize: none;
    pointer-events: none;
  }
</style>
