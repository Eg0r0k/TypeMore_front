<template>
  <div class="chat">
    <div class="chat__messages">
      <div class="message" v-for="i in 100" :key="i">Hello</div>
    </div>
    <div class="chat__input">
      <div class="chat__emoji-suggestion" v-if="showSuggestion">
        <div
          class="suggestion"
          v-for="(suggestion, index) in suggestions"
          :key="index"
          :class="{ 'suggestion--active': index === activeIndex }"
          @click="selectSuggestion(suggestion)"
        >
          <div class="suggestion__icon">
            <img
              draggable="false"
              src="https://cdn.discordapp.com/emojis/1058080458426032128.png?v=1"
            />
          </div>
          <Typography size="xs">{{ suggestion.text }}</Typography>
        </div>
      </div>
      <TextInput
        v-model="inputValue"
        :class="inputClasses"
        placeholder="Send a message (press / to focus)"
        @keydown="handleKeyDown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import { watchThrottled } from '@vueuse/core'
  import clsx from 'clsx'
  import { computed, ref } from 'vue'

  const activeIndex = ref(0)
  const showSuggestion = ref(false)
  const inputValue = ref('')
  const searchPattern = /:([a-zA-Z]*)$/
  const inputClasses = computed(() =>
    clsx({
      'chat__input--flat': showSuggestion.value,
      'chat__input--tag': !showSuggestion.value
    })
  )

  const suggestions = ref([
    { text: 'Icon exemple 1', value: 'icon1' },
    { text: 'Icon exemple 2', value: 'icon2' }
  ])

  watchThrottled(
    inputValue,
    (newValue) => {
      showSuggestion.value = searchPattern.test(newValue)
    },
    { throttle: 200 }
  )

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!showSuggestion.value) return

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        activeIndex.value =
          (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length
        break
      case 'ArrowDown':
        event.preventDefault()
        activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
        break
      case 'Tab':
      case 'Enter':
        if (showSuggestion.value) {
          event.preventDefault()
          selectSuggestion(suggestions.value[activeIndex.value])
        }
        break
    }
  }

  const selectSuggestion = (suggestion: { value: string }) => {
    inputValue.value = inputValue.value.replace(searchPattern, `:${suggestion.value}: `)
    showSuggestion.value = false
    activeIndex.value = 0
  }
</script>

<style lang="scss" scoped>
  :deep(.chat__input--flat) {
    border-radius: 0 0 var(--border-radius) var(--border-radius) !important;
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
      overflow-y: scroll;
    }
  }
</style>
