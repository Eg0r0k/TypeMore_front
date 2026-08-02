<template>
  <!--
    `contenteditable`, not `<input>`, and that is the entire reason this file
    exists: an input's value is a string, so an emoji in it can only ever be the
    text `:name:`. Here a picked emoji is a real `<img>` node, so you see the
    picture you chose while you are still writing the message.

    What goes OUT is unchanged. `serialize` walks the nodes and turns every
    `<img data-emoji>` back into its `:name:` token, so the wire, the log and
    every other client see exactly what they always did.
  -->
  <div
    ref="editor"
    class="chat-editor"
    :class="{ 'is-empty': isEmpty }"
    contenteditable="plaintext-only"
    role="textbox"
    tabindex="0"
    :aria-label="placeholder"
    :data-placeholder="placeholder"
    data-testid="chat-input"
    @input="onInput"
    @keydown="onKeydown"
    @paste="onPaste"
    @copy="onCopy"
    @cut="onCut"
    @blur="saveSelection"
  ></div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

  import { emojis, type Emoji } from '@/shared/lib/helpers/emoji'

  const props = withDefaults(defineProps<{ placeholder?: string; maxLength?: number }>(), {
    placeholder: '',
    maxLength: 200
  })

  const emit = defineEmits<{ submit: [] }>()

  /** The message as the wire carries it: text with `:name:` tokens. */
  const model = defineModel<string>({ default: '' })

  const editor = useTemplateRef<HTMLElement>('editor')
  const isEmpty = ref(true)

  const byName = computed(() => new Map(emojis.map((emoji) => [emoji.value, emoji])))

  /** DOM → the token string. The `<br>` a browser leaves behind counts as nothing. */
  const serialize = (root: HTMLElement): string => {
    let out = ''
    for (const node of Array.from(root.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent ?? ''
      } else if (node instanceof HTMLImageElement && node.dataset.emoji) {
        out += `:${node.dataset.emoji}:`
      } else if (node instanceof HTMLElement) {
        // A browser may wrap on paste or on Enter despite `plaintext-only`;
        // whatever it wrapped is still text as far as the message goes.
        out += node.tagName === 'BR' ? '' : (node.textContent ?? '')
      }
    }
    return out
  }

  const imageFor = (emoji: Emoji): HTMLImageElement => {
    const image = document.createElement('img')
    image.src = emoji.icon
    // Hotlink protection keyed on the referrer is a common reason a CDN serves
    // an image to one browser and not another; sending none costs nothing here.
    image.referrerPolicy = 'no-referrer'
    /*
     * The ALT is the token, colons and all, because alt is what a browser puts
     * on the clipboard when an image inside a contenteditable is copied. So
     * copying an emoji yields `:pepeChill:` — text that pastes back into this
     * field as the picture, and into anywhere else as something a reader can
     * recognise. The human name lives in `title`, where it is read on hover.
     */
    image.alt = `:${emoji.value}:`
    image.title = emoji.text
    image.draggable = false
    image.dataset.emoji = emoji.value
    image.className = 'chat-editor__emoji'
    return image
  }

  /** The token pattern, matching what {@link EMOJI_NAME_PATTERN} allows. */
  const TOKEN = /:([A-Za-z0-9_-]{1,32}):/g

  /**
   * A fragment for `text`, with every KNOWN token turned into its image and
   * everything else left as text. Used both when rendering the model and when
   * something is pasted — pasting `:sadge:` should give you the same thing
   * picking it from the tray does.
   */
  const fragmentFor = (text: string): DocumentFragment => {
    const fragment = document.createDocumentFragment()
    let cursor = 0
    for (const match of text.matchAll(TOKEN)) {
      const emoji = byName.value.get(match[1])
      if (!emoji) continue
      const before = text.slice(cursor, match.index)
      if (before) fragment.append(document.createTextNode(before))
      fragment.append(imageFor(emoji))
      cursor = match.index + match[0].length
    }
    const tail = text.slice(cursor)
    if (tail) fragment.append(document.createTextNode(tail))
    return fragment
  }

  /** The current selection as the wire would carry it. */
  const selectionAsText = (): string => {
    const root = editor.value
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return ''
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return ''
    const holder = document.createElement('div')
    holder.append(range.cloneContents())
    return serialize(holder)
  }

  /** Token string → nodes. The ONLY way content is written into the editor. */
  const render = (value: string): void => {
    const root = editor.value
    if (!root) return
    root.replaceChildren(fragmentFor(value))
    isEmpty.value = root.childNodes.length === 0
  }

  const sync = (): void => {
    const root = editor.value
    if (!root) return
    model.value = serialize(root)
    isEmpty.value = root.childNodes.length === 0 || serialize(root) === ''
  }

  const onInput = (): void => {
    const root = editor.value
    if (!root) return
    const value = serialize(root)
    if (value.length <= props.maxLength) {
      sync()
      return
    }
    /*
     * Over the cap: keep as much as FITS, the way a `maxlength` input does with
     * a paste. Refusing the whole insert was worse — pasting 20 characters with
     * 5 of room left dropped all 20, and the field simply stopped responding.
     *
     * The caret goes back where it was, not to the end: re-rendering rebuilds
     * the DOM, and without this, editing the middle of a full message threw you
     * to the bottom of it.
     */
    const offset = caretOffset()
    // A cut token would leave `:sad` as literal text; drop the fragment.
    const trimmed = value.slice(0, props.maxLength).replace(/:[A-Za-z0-9_-]{0,32}$/, '')
    model.value = trimmed
    render(trimmed)
    placeCaretAt(Math.min(offset ?? trimmed.length, trimmed.length))
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    // One line, one message: Enter sends, and a newline in a chat box that has
    // no multi-line story is just a way to make the row jump.
    event.preventDefault()
    emit('submit')
  }

  const onPaste = (event: ClipboardEvent): void => {
    // Plain text only — `plaintext-only` already refuses markup where it is
    // honoured, this makes the rest behave the same — and every `:name:` in it
    // comes back as its picture, so a copied emoji pastes as an emoji.
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    insertNode(fragmentFor(text))
  }

  /**
   * Copy and cut write the TOKEN form. A browser would otherwise put an image's
   * alt on the clipboard for the image and nothing sensible for a mixed
   * selection; this makes what leaves the field exactly what the field would
   * have sent.
   */
  const onCopy = (event: ClipboardEvent): void => {
    const text = selectionAsText()
    if (!text) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', text)
  }

  const onCut = (event: ClipboardEvent): void => {
    const text = selectionAsText()
    if (!text) return
    event.preventDefault()
    event.clipboardData?.setData('text/plain', text)
    window.getSelection()?.deleteFromDocument()
    sync()
  }

  // ── selection ─────────────────────────────────────────────────────────────
  /**
   * Where the caret was when the editor last lost focus. Picking an emoji moves
   * the focus to the picker, so without this every pick would land at the end
   * of the message instead of where you were writing.
   */
  let savedRange: Range | null = null

  const saveSelection = (): void => {
    const selection = window.getSelection()
    const root = editor.value
    if (!selection || !root || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (root.contains(range.commonAncestorContainer)) savedRange = range.cloneRange()
  }

  /** How many serialized characters sit before a point in the editor. */
  const offsetAt = (container: Node, offset: number): number => {
    const root = editor.value
    if (!root) return 0
    const range = document.createRange()
    range.setStart(root, 0)
    range.setEnd(container, offset)
    const holder = document.createElement('div')
    holder.append(range.cloneContents())
    return serialize(holder).length
  }

  /** The caret as an offset into the message, or `null` when it is elsewhere. */
  const caretOffset = (): number | null => {
    const root = editor.value
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer)) return null
    return offsetAt(range.startContainer, range.startOffset)
  }

  /** Put the caret back at a message offset after the DOM has been rebuilt. */
  const placeCaretAt = (target: number): void => {
    const root = editor.value
    if (!root) return
    let seen = 0
    for (const node of Array.from(root.childNodes)) {
      const isEmoji = node instanceof HTMLImageElement && node.dataset.emoji
      const length =
        node.nodeType === Node.TEXT_NODE
          ? (node.textContent ?? '').length
          : isEmoji
            ? (node as HTMLImageElement).dataset.emoji!.length + 2
            : 0
      if (seen + length >= target) {
        const range = document.createRange()
        if (node.nodeType === Node.TEXT_NODE) {
          range.setStart(node, Math.max(0, target - seen))
        } else {
          // Halfway through an emoji is not a position anyone can be in.
          range.setStartAfter(node)
        }
        range.collapse(true)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        savedRange = range.cloneRange()
        return
      }
      seen += length
    }
    placeCaretAtEnd()
  }

  const placeCaretAtEnd = (): void => {
    const root = editor.value
    if (!root) return
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRange = range.cloneRange()
  }

  const insertNode = (node: Node): void => {
    const root = editor.value
    if (!root) return
    root.focus()
    const selection = window.getSelection()
    if (!selection) return
    // Restore where the caret was before the focus went to the picker; with no
    // remembered position, the end of the message is the honest default.
    if (savedRange && root.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges()
      selection.addRange(savedRange)
    } else if (selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
      placeCaretAtEnd()
    }
    const range = selection.getRangeAt(0)
    // A fragment is EMPTIED by `insertNode`, so the node the caret has to land
    // after must be taken before the insert — asking a spent fragment where it
    // ended up throws.
    const last = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? node.lastChild : node
    range.deleteContents()
    range.insertNode(node)
    if (last) range.setStartAfter(last)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRange = range.cloneRange()
    sync()
  }

  /** Insert an emoji where the caret is. Refused when it would break the cap. */
  const insert = (emoji: Emoji): void => {
    if (model.value.length + `:${emoji.value}:`.length > props.maxLength) return
    insertNode(imageFor(emoji))
  }

  const focus = (): void => {
    editor.value?.focus()
    placeCaretAtEnd()
  }

  const clear = (): void => {
    model.value = ''
    render('')
    savedRange = null
  }

  defineExpose({ insert, focus, clear })

  // An external write (the parent clearing after send) re-renders; a write that
  // came FROM this editor is already on screen and must not reset the caret.
  watch(model, (value) => {
    const root = editor.value
    if (!root || serialize(root) === value) return
    render(value)
  })

  onMounted(() => render(model.value))
</script>

<style lang="scss" scoped>
  /*
   * A BLOCK, and that is load-bearing. As a flex container every loose run of
   * text became an anonymous flex item, and the browser's caret and selection
   * logic does not survive that: deleting a phrase left the caret stranded at
   * the end of the box instead of where the text had been. Inline layout with
   * `vertical-align` on the images is what a contenteditable expects.
   */
  .chat-editor {
    display: block;
    flex: 1;
    min-width: 0;

    // One line's worth by default, growing to three before it scrolls: a chat
    // box that grows without bound pushes the room out of the way.
    min-height: 2.5rem;
    max-height: 6rem;
    padding: 0.375rem 0.75rem;
    overflow-y: auto;
    font-size: 1rem;
    line-height: 1.5rem;
    color: var(--text-color);
    caret-color: var(--main-color);
    overflow-wrap: anywhere;
    outline: none;

    @media (width >= 640px) {
      font-size: 0.875rem;
    }

    /*
     * The placeholder: a real `<input>` gets one for free, a contenteditable
     * does not. Absolutely positioned rather than an in-flow `::before` — in
     * flow it is a box the caret has to be placed around, and on an empty
     * editor the caret ended up after it.
     */
    &.is-empty::before {
      position: absolute;
      color: var(--sub-color);
      pointer-events: none;
      content: attr(data-placeholder);
    }

    /*
     * `width: auto`, NOT a fixed box — this is what the `:L` bug actually was.
     * A broken image renders its alt INSIDE its content box, so a 1.375rem
     * square cut `:LICKING:` down to the first character and a half. Sized by
     * height alone, a dead icon falls back to its whole token, which is exactly
     * what the message contains, and becomes the picture again if it loads on a
     * later visit. `inline-block` because Tailwind's preflight resets `img` to
     * `display: block`, which would put every emoji on its own line.
     */
    :deep(.chat-editor__emoji) {
      display: inline-block;
      width: auto;
      height: 1.375rem;
      object-fit: contain;
      vertical-align: -0.25rem;
      user-select: none;
    }
  }
</style>
