<template>
  <div class="chat">
    <div class="chat__log">
      <VirtualScrollable
        ref="messagesContainer"
        class="chat__messages"
        :items="session.chatLog"
        :estimate-size="MESSAGE_HEIGHT"
        :get-item-key="keyAt"
        @scroll="onScroll"
      >
        <template #default="{ item: entry }">
          <div :class="messageClass(entry)">
            <template v-if="entry.from === 'system'">
              <div class="message__text message__text--system">{{ entry.text }}</div>
            </template>
            <template v-else>
              <div
                class="message__author"
                :class="{ 'message__author--me': entry.from === session.selfId }"
                :title="nickOf(entry)"
              >
                {{ nickOf(entry) }}:
              </div>
              <!-- eslint-disable-next-line vue/no-v-html -- parseEmojis HTML-escapes its input first -->
              <div class="message__text" v-html="parseEmojis(entry.text)"></div>
            </template>
          </div>
        </template>
      </VirtualScrollable>
      <button
        v-if="unseenCount > 0"
        class="chat__new-messages"
        type="button"
        data-testid="chat-new-messages"
        @click="jumpToNew"
      >
        {{ t('room.chat.newMessages') }} ↓
      </button>
    </div>
    <div class="chat__input">
      <!--
        ONE control: the field owns the surface and the focus ring, and the
        button lives inside it. `InputGroup` is what makes that a single box
        rather than an input with something parked beside it.
      -->
      <InputGroup class="chat__field">
        <ChatInput
          ref="chatInput"
          v-model="inputValue"
          :max-length="MAX_MESSAGE"
          :placeholder="t('room.chat.placeholder')"
          @submit="sendMessage"
        />
        <InputGroupAddon align="inline-end">
          <!-- Shown only once the cap is in sight. A counter that is always
               there is one more thing to read on every message; one that
               appears at the end is the warning it is meant to be. -->
          <span
            v-if="remaining <= COUNTER_FROM"
            class="chat__counter"
            :class="{ 'chat__counter--full': remaining === 0 }"
            data-testid="chat-counter"
            aria-live="polite"
          >
            {{ remaining }}
          </span>
          <!-- The desktop's picker. On a phone the same button opens the tray
               below instead, so the popover is held closed there. -->
          <Popover :open="popoverOpen" @update:open="pickerOpen = $event">
            <PopoverAnchor as-child>
              <InputGroupButton
                :class="{ 'text-text': pickerOpen }"
                :aria-label="t('room.chat.emoji')"
                :aria-expanded="pickerOpen"
                :title="t('room.chat.emoji')"
                data-testid="chat-emoji-button"
                @click="pickerOpen = !pickerOpen"
              >
                <IconMood aria-hidden="true" />
              </InputGroupButton>
            </PopoverAnchor>
            <PopoverContent side="top" align="end" class="w-auto p-2">
              <EmojiPicker @select="insertEmoji" />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>

      <!--
        The phone's picker is a TRAY, not a panel under the field: it comes up
        from the bottom edge of the screen and holds it, the way the system
        keyboard it stands in for does. A popover pinned under an input that is
        itself near the bottom of a small screen is neither one nor the other.
      -->
      <Sheet v-if="isCompact" :open="pickerOpen" @update:open="pickerOpen = $event">
        <SheetContent
          side="bottom"
          class="max-h-[70vh]"
          data-testid="chat-emoji-sheet"
          @open-auto-focus.prevent
        >
          <SheetTitle class="sr-only">{{ t('room.chat.emojiPicker') }}</SheetTitle>
          <SheetDescription class="sr-only">{{ t('room.chat.emojiSearch') }}</SheetDescription>
          <EmojiPicker :columns="8" @select="insertEmoji" />
        </SheetContent>
      </Sheet>

      <!-- What the server said about the message you just tried to send. -->
      <Typography
        v-if="sendError"
        class="chat__error"
        size="xs"
        color="error"
        role="alert"
        data-testid="chat-error"
      >
        {{ sendError }}
      </Typography>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ChatEntry, RoomPlayer } from '@/entities/lobby'
  import { useMatchSessionStore } from '@/entities/match'
  import { parseEmojis, type Emoji } from '@/shared/lib/helpers/emoji'
  import { InputGroup, InputGroupAddon, InputGroupButton } from '@/shared/ui/input-group'
  import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/popover'
  import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/shared/ui/sheet'
  import { Typography } from '@/shared/ui/typography'
  import { VirtualScrollable } from '@/shared/ui/virtualScrollable'
  import { useMediaQuery } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import clsx from 'clsx'
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import IconMood from '~icons/tabler/mood-smile'

  import ChatInput from './chat-input.vue'
  import EmojiPicker from './emoji-picker.vue'

  /**
   * Lobby chat over the session store's chatLog. Player text goes through
   * `parseEmojis` (which HTML-escapes before emoji substitution — remote text
   * never reaches v-html raw). System messages (§4 `chat` with `from:
   * "system"`) render distinctly, styled per `kind`. A `rate_limited` reject
   * (§3 chat_send: burst 5 / 2 s) surfaces under the input.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()

  const inputValue = ref('')

  /**
   * The picker replaced a `:`-triggered dropdown. The TOKEN it inserts is the
   * same `:name:` the wire has always carried — only the way you reach it
   * changed, from typing a colon and hoping to a button that shows you what
   * there is.
   *
   * Below `md` there is no room for a popover over a chat that is already the
   * width of the screen, so the same component renders under the input instead.
   */
  const pickerOpen = ref(false)
  const isCompact = useMediaQuery('(max-width: 767px)')
  const popoverOpen = computed(() => pickerOpen.value && !isCompact.value)

  // Leaving the phone layout with the inline picker open would otherwise pop it
  // straight back as a popover.
  watch(isCompact, () => (pickerOpen.value = false))

  /**
   * The editor owns the caret and the DOM, so insertion is its job: this only
   * says WHAT to insert and then closes the picker.
   *
   * Closed on pick, and deliberately: the focus goes straight back to the
   * message so you can keep typing, and a popover left open while the focus has
   * gone is one the next click closes by accident.
   */
  const insertEmoji = (emoji: Emoji): void => {
    chatInput.value?.insert(emoji)
    pickerOpen.value = false
  }

  /** Row height estimate; single-line rows, the virtualizer measures wrapped ones. */
  const MESSAGE_HEIGHT = 28

  /**
   * Structural, not `InstanceType<typeof VirtualScrollable>`: the component is
   * generic, so naming its instance type here would pin `T` to whatever this
   * file happens to infer. Only the one method is used.
   */
  interface VirtualList {
    scrollToEnd: (behavior?: ScrollBehavior) => void
  }

  const messagesContainer = ref<VirtualList | null>(null)
  /** The editor's exposed API — see `chat-input.vue`. */
  const chatInput = ref<{
    insert: (emoji: Emoji) => void
    focus: () => void
    clear: () => void
  } | null>(null)

  const keyAt = (index: number) => session.chatLog[index]?.id ?? index

  const messageClass = (entry: ChatEntry) =>
    clsx('message', {
      'message--system': entry.from === 'system',
      [`message--${entry.kind?.replace(/_/g, '-')}`]: entry.kind !== undefined
    })

  const nickOf = (entry: ChatEntry) =>
    entry.nick ??
    session.room?.players.find((player: RoomPlayer) => player.playerId === entry.from)?.nick ??
    entry.from.slice(0, 8)

  // ── the message cap ───────────────────────────────────────────────────────
  /** PROTOCOL.md §3 `chat_send`: the server refuses anything longer. */
  const MAX_MESSAGE = 200
  /** How much room is left before the counter is worth showing. */
  const COUNTER_FROM = 40

  const remaining = computed(() => MAX_MESSAGE - inputValue.value.length)

  // ── what the server said ──────────────────────────────────────────────────
  /**
   * Errors the server sends back about a message you just tried to post — the
   * chat rate limit above all, which is what you hit by sending too fast and
   * which was previously invisible: the old line only ever rendered
   * `rate_limited`, only while `lastError` still happened to hold it, and never
   * went away again.
   *
   * `lastError` is the session's LAST error from anywhere, and the protocol
   * carries no correlation id, so attribution is by time: an error that lands
   * within a moment of our own send is ours. The same approach the join-code
   * modal takes, for the same missing field.
   */
  const sendError = ref<string | null>(null)
  let sentAt = 0
  let clearTimer = 0

  const ERROR_KEYS: Readonly<Record<string, string>> = {
    rate_limited: 'room.chat.error.rateLimited',
    not_in_room: 'room.chat.error.notInRoom',
    forbidden: 'room.chat.error.forbidden',
    bad_message: 'room.chat.error.badMessage',
    internal: 'room.chat.error.internal'
  }

  const showError = (code: string, fallback: string): void => {
    const key = ERROR_KEYS[code]
    // The server's own message when this app has no words for the code: a raw
    // string beats saying nothing, and a new code must not fall silent.
    sendError.value = key ? t(key) : fallback
    window.clearTimeout(clearTimer)
    clearTimer = window.setTimeout(() => (sendError.value = null), 5000)
  }

  watch(
    () => session.lastError,
    (error) => {
      if (!error) return
      if (Date.now() - sentAt > 3000) return
      showError(error.code, error.message)
    }
  )

  onUnmounted(() => window.clearTimeout(clearTimer))

  const sendMessage = () => {
    const text = inputValue.value.trim()
    if (!text) return
    if (text.length > MAX_MESSAGE) return
    sendError.value = null
    sentAt = Date.now()
    session.sendChat(text)
    chatInput.value?.clear()
    // Sending re-pins the view: your own message (it arrives as a server echo)
    // must always come into view, wherever the chat was scrolled.
    pinned.value = true
    unseenCount.value = 0
    scrollToBottom()
  }

  // ── scroll pinning ────────────────────────────────────────────────────────
  /**
   * The view auto-follows new messages ONLY while it is pinned to the bottom.
   * Scrolled up to read history, it stays put and counts the arrivals into the
   * "new messages" pill instead; the pill (or scrolling back down, or sending)
   * re-pins it. `pinned` is owned by the scroll handler — the one source of
   * truth for "where the user actually is".
   */
  const STICK_THRESHOLD_PX = 48

  const pinned = ref(true)
  const unseenCount = ref(0)

  const onScroll = (event: Event) => {
    const el = event.target as HTMLElement
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD_PX
    pinned.value = atBottom
    if (atBottom) unseenCount.value = 0
  }

  /**
   * Two frames past nextTick, not one tick: the virtualizer measures the new
   * row only after it renders (its own nextTick + rAF), and `scrollToEnd`
   * computes the target from the CURRENT scrollHeight. Scrolling off the
   * not-yet-measured size is exactly what used to land the view short of the
   * last message.
   */
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messagesContainer.value?.scrollToEnd(behavior)
        })
      })
    })
  }

  const jumpToNew = () => {
    pinned.value = true
    unseenCount.value = 0
    scrollToBottom()
  }

  watch(
    () => session.chatLog.length,
    (length, previous) => {
      if (length === 0) {
        // A new room starts a new chat: nothing unseen from the old one.
        pinned.value = true
        unseenCount.value = 0
        return
      }
      if (length < previous) return
      if (pinned.value) scrollToBottom()
      else unseenCount.value += length - previous
    }
  )

  onMounted(() => scrollToBottom('auto'))
</script>
<style lang="scss" scoped>
  .message {
    // Padding, not margin: the virtualizer sizes rows by their border box,
    // and a margin would fall outside the measured height.
    padding-top: 0.25rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;

    &__author {
      // The name never wraps and never squeezes the message; a very long one
      // gives up its own tail instead (the full text stays in the title).
      flex-shrink: 0;
      max-width: 45%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;

      &--me {
        color: var(--main-color);
      }
    }

    /*
     * NOT a flex row. As a flex item this had `min-width: auto`, so it could
     * not shrink below its longest word: one long message widened the row, the
     * row widened the chat, and the chat widened its grid column instead of
     * wrapping. As a plain block with `min-width: 0` it takes the width it is
     * given and breaks the text — including an unbroken 200-character string,
     * which is what `anywhere` is for.
     */
    &__text {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;

      &--system {
        font-style: italic;
        color: var(--sub-color);
      }
    }

    &--host-changed .message__text--system,
    &--settings-changed .message__text--system {
      color: var(--main-color);
    }
  }

  .chat {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;

    // The chat is a grid item in the lobby; without this it may not shrink
    // below its own min-content and would push its column wider (the same
    // reason each message has to be able to break).
    min-width: 0;

    &__log {
      // Anchor for the new-messages pill; the pill floats over the log, so it
      // never reflows the messages or the input under it.
      position: relative;
    }

    &__new-messages {
      position: absolute;
      bottom: 0.75rem;
      left: 50%;
      z-index: 5;
      padding: 0.25rem 0.75rem;
      font-size: 0.8rem;
      color: var(--main-color);
      cursor: pointer;
      background-color: var(--sub-alt-color);
      border: none;
      border-radius: var(--border-radius);
      transform: translateX(-50%);
      transition: var(--transition-duration);

      &:hover {
        color: var(--text-color);
      }
    }

    &__input {
      position: relative;
    }

    // The phone's picker: its own card under the field, not floating over it.
    &__picker {
      margin-top: 0.375rem;
      padding: 0.5rem;
      background-color: var(--sub-alt-color);
      border: 1px solid var(--sub-color);
      border-radius: var(--border-radius, 0.375rem);
    }

    &__error {
      display: block;
      margin-top: 0.25rem;
    }

    // Inside the field, beside the emoji button: a number, not a sentence.
    &__counter {
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: var(--sub-color);
      user-select: none;

      &--full {
        color: var(--error-color);
      }
    }

    // Compound with the component's own class to outweigh its
    // `.scrollable-direction-y { height: 100% }` rule.
    &__messages.scrollable-wrapper {
      height: 20rem;
      margin-bottom: 0.25rem;
    }
  }
</style>
