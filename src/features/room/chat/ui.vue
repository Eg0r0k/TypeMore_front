<template>
  <div class="chat">
    <VirtualScrollable
      ref="messagesContainer"
      class="chat__messages"
      :items="session.chatLog"
      :estimate-size="MESSAGE_HEIGHT"
      :get-item-key="keyAt"
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
            >
              {{ nickOf(entry) }}:
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -- parseEmojis HTML-escapes its input first -->
            <div class="message__text" v-html="parseEmojis(entry.text)"></div>
          </template>
        </div>
      </template>
    </VirtualScrollable>
    <div class="chat__input">
      <div v-if="showSuggestion" class="chat__emoji-suggestion">
        <div
          v-for="(suggestion, index) in filteredSuggestions.slice(0, 3)"
          :key="index"
          class="suggestion"
          :class="{ 'suggestion--active': index === activeIndex }"
          @click="selectSuggestion(suggestion)"
        >
          <div class="suggestion__icon">
            <img draggable="false" :src="suggestion.icon" alt="" />
          </div>
          <Typography size="xs">{{ suggestion.text }}</Typography>
        </div>
      </div>
      <TextInput
        ref="chatInput"
        v-model="inputValue"
        v-max-chars="200"
        :class="inputClasses"
        :placeholder="t('room.chat.placeholder')"
        @keydown.enter="sendMessage"
        @keydown="handleKeyDown"
      />
      <Typography v-if="rateLimited" class="chat__rate-limited" size="xs" color="error">
        {{ t('room.chat.rateLimited') }}
      </Typography>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ChatEntry, RoomPlayer } from '@/entities/lobby'
  import { useMatchSessionStore } from '@/entities/match'
  import type { TextInputComponent } from '@/shared/directives/utils'
  import { emojis, parseEmojis } from '@/shared/lib/helpers/emoji'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import { VirtualScrollable } from '@/shared/ui/virtualScrollable'
  import { watchThrottled } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import clsx from 'clsx'
  import { computed, nextTick, ref, watchEffect } from 'vue'

  /**
   * Lobby chat over the session store's chatLog. Player text goes through
   * `parseEmojis` (which HTML-escapes before emoji substitution — remote text
   * never reaches v-html raw). System messages (§4 `chat` with `from:
   * "system"`) render distinctly, styled per `kind`. A `rate_limited` reject
   * (§3 chat_send: burst 5 / 2 s) surfaces under the input.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()

  const activeIndex = ref(0)
  const showSuggestion = ref(false)
  const inputValue = ref('')
  const searchPattern = /:(\w*)$/

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
  const chatInput = ref<TextInputComponent | null>(null)

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

  const rateLimited = computed(() => session.lastError?.code === 'rate_limited')

  const sendMessage = () => {
    const text = inputValue.value.trim()
    if (!text) return
    session.sendChat(text)
    inputValue.value = ''
    scrollToBottom()
  }

  const isCursorImmediatelyAfterClosedTag = (text: string) => /:\w+:$/.test(text)

  const inputClasses = computed(() =>
    clsx({
      'chat__input--flat': showSuggestion.value,
      'chat__input--tag': !showSuggestion.value
    })
  )

  const suggestions = ref([...emojis])

  const filteredSuggestions = computed(() => {
    const match = inputValue.value.match(searchPattern)
    const query = match ? match[1].toLowerCase() : ''
    return suggestions.value.filter((suggestion) => suggestion.value.toLowerCase().includes(query))
  })

  watchThrottled(
    inputValue,
    (newValue) => {
      const isValidPattern = searchPattern.test(newValue)
      const cursorNotAfterClosedTag = !isCursorImmediatelyAfterClosedTag(newValue)
      showSuggestion.value = isValidPattern && cursorNotAfterClosedTag
    },
    { throttle: 200 }
  )

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!showSuggestion.value) return
    const visibleSuggestions = filteredSuggestions.value.slice(0, 3)
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        activeIndex.value =
          (activeIndex.value - 1 + visibleSuggestions.length) % visibleSuggestions.length
        break
      case 'ArrowDown':
        event.preventDefault()
        activeIndex.value = (activeIndex.value + 1) % visibleSuggestions.length
        break
      case 'Tab':
        if (showSuggestion.value) {
          event.preventDefault()
          selectSuggestion(visibleSuggestions[activeIndex.value])
        }
        break
    }
  }

  const selectSuggestion = (suggestion: { value: string }) => {
    inputValue.value = inputValue.value.replace(searchPattern, `:${suggestion.value}:`)
    showSuggestion.value = false
    activeIndex.value = 0
  }
  const scrollToBottom = () => {
    nextTick(() => {
      messagesContainer.value?.scrollToEnd()
    })
  }

  watchEffect(() => {
    // Track log growth so new messages keep the view pinned to the bottom.
    void session.chatLog.length
    scrollToBottom()
  })
</script>
<style lang="scss" scoped>
  :deep(.chat__input--flat) {
    border-radius: 0 0 var(--border-radius) var(--border-radius) !important;
  }

  .message {
    // Padding, not margin: the virtualizer sizes rows by their border box,
    // and a margin would fall outside the measured height.
    padding-top: 0.25rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    overflow-wrap: break-word;

    &__author {
      word-break: normal;
      height: 100%;

      &--me {
        color: var(--main-color);
      }
    }

    &__text {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      flex-wrap: wrap;

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

  .suggestion {
    display: grid;
    grid-template-columns: 1.25em 1fr;
    gap: 1em;
    padding: 0.5em 1em;
    transition: var(--transition-duration);

    &--active {
      background-color: var(--text-color);
      color: var(--bg-color);
    }

    &:first-child {
      border-radius: var(--border-radius) var(--border-radius) 0 0;
    }

    &__icon {
      width: 1.25rem;
      height: 1.25rem;

      & img {
        user-select: none;
        width: 100%;
        height: auto;
      }
    }
  }

  .chat {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;

    &__input {
      position: relative;
    }

    &__rate-limited {
      display: block;
      margin-top: 0.25rem;
    }

    &__emoji-suggestion {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      display: flex;
      width: 100%;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius) var(--border-radius) 0 0;
      transform: translateY(-100%);
      flex-direction: column;
    }

    // Compound with the component's own class to outweigh its
    // `.scrollable-direction-y { height: 100% }` rule.
    &__messages.scrollable-wrapper {
      height: 20rem;
      margin-bottom: 0.25rem;
    }
  }
</style>
