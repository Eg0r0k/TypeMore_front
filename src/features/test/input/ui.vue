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
  import { useSounds } from '@/shared/lib/hooks/useSounds'
  import { useConfigStore } from '@/entities/config/model/store'
  import { getSoundPack } from '@/shared/constants/sound-packs'

  /**
   * Hidden keystroke-capture surface. The DOM value is NEVER the source of truth:
   * every mutation is prevented and translated into a core event, so the reducer
   * state is the only truth.
   *
   * Contract:
   *  - `insert` carries strictly ONE grapheme per keystroke; any multi-character
   *    input (autocomplete, mobile suggestion) is routed through `replace`.
   *  - Paste → `preventDefault` + `replace` with `source: 'paste'`.
   *  - IME composition is UNSUPPORTED for now: composition events never emit an
   *    insert (blocked here); wiring composed text through `replace` is future work.
   *  - No async, no side-effecting store getters on this path — stamp + dispatch only.
   */
  const props = defineProps<{ store: GameSession }>()
  const store = props.store

  const inputRef = ref<HTMLTextAreaElement | null>(null)

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
      store.commit()
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

    if (type === 'insertText') {
      event.preventDefault()
      const data = event.data ?? ''
      const graphemes = [...data]
      if (graphemes.length === 1) {
        // Feedback first: caretPos() must read the pre-insert position.
        playKeyFeedback(data)
        store.insert(data)
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

  const emit = defineEmits<{ (event: 'focus'): void; (event: 'blur'): void }>()

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
