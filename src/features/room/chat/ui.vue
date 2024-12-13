<template>
  <div class="chat">
    <div class="chat__messages" ref="messagesContainer">
      <div v-for="message in messages" :key="message.id" class="message">
        <div class="message__author">{{ message.username }}:</div>
        <div class="message__text" v-html="parseEmojis(message.text)"></div>
      </div>
    </div>
    <div class="chat__input">
      <div class="chat__emoji-suggestion" v-if="showSuggestion">
        <div
          class="suggestion"
          v-for="(suggestion, index) in filteredSuggestions.slice(0, 3)"
          :key="index"
          :class="{ 'suggestion--active': index === activeIndex }"
          @click="selectSuggestion(suggestion)"
        >
          <div class="suggestion__icon">
            <img draggable="false" :src="suggestion.icon" />
          </div>
          <Typography size="xs">{{ suggestion.text }}</Typography>
        </div>
      </div>
      <TextInput
        ref="chatInput"
        @keydown.enter="sendMessage"
        v-max-chars="256"
        v-model="inputValue"
        :class="inputClasses"
        placeholder="Send a message"
        @keydown="handleKeyDown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useAuthStore } from '@/entities/auth/model/store'
  import { useChatStore } from '@/entities/chat/model/store'
  import { TextInputComponent } from '@/shared/directives/utils'
  import { emojis, parseEmojis } from '@/shared/lib/helpers/emoji'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import { watchThrottled } from '@vueuse/core'
  import clsx from 'clsx'
  import { computed, nextTick, ref, watchEffect } from 'vue'

  const activeIndex = ref(0)
  const showSuggestion = ref(false)
  const inputValue = ref('')
  const searchPattern = /:(\w*)$/

  const chatStore = useChatStore()
  const authStore = useAuthStore()

  const messagesContainer = ref<HTMLElement | null>(null)
  const chatInput = ref<TextInputComponent | null>(null)
  const messages = computed(() => chatStore.messages)

  const sendMessage = () => {
    if (inputValue.value.trim()) {
      chatStore.addMessage(authStore.user?.username || 'Guest', inputValue.value)
      inputValue.value = ''
      scrollToBottom()
    }
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
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }

  watchEffect(() => {
    scrollToBottom()
  })
</script>
<style lang="scss" scoped>
  :deep(.chat__input--flat) {
    border-radius: 0 0 var(--border-radius) var(--border-radius) !important;
  }

  .message {
    margin-top: 0.25rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    word-break: break-word;

    &__author {
      word-break: normal;
      height: 100%;
    }

    &__text {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      flex-wrap: wrap;
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

    &__messages {
      height: 20rem;
      margin-bottom: 0.25rem;
      scroll-behavior: smooth;
      overflow-y: scroll;
    }
  }
</style>
