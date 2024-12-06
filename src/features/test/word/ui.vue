<template>
  <p
    ref="wordsRef"
    class="word"
    :class="{ active: props.wordIndex === testState.currentWordElementIndex }"
  >
    <span
      v-for="(letter, letterIndex) in props.word"
      :key="`${letter}-${letterIndex}`"
      :class="[
        inputStore.getLetterClass(wordIndex, letterIndex),
        { 'tab-character': letter === '\t', 'newline-character': letter === '\n' }
      ]"
    >
      {{ letter === '\t' ? '→' : letter === '\n' ? '↵' : letter }}
    </span>
    <span
      v-for="(extraLetter, extraLetterIndex) in inputStore.getExtraLetters(wordIndex)"
      :key="`extra-${extraLetter}-${extraLetterIndex}`"
      class="over-incorrect"
    >
      {{ extraLetter }}
    </span>
  </p>
</template>

<script lang="ts" setup>
  import { useInputStore } from '@entities/input/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'

  interface Props {
    word: string
    wordIndex: number
  }
  const props = defineProps<Props>()

  const inputStore = useInputStore()
  const testState = useTestStateStore()
</script>

<style lang="scss" scoped>
  .incorrect {
    color: var(--error-color) !important;
  }

  .over-incorrect {
    color: var(--error-extra-color) !important;
  }

  .correct {
    color: var(--text-color) !important;
  }

  .word {
    position: relative;
    margin: 0.25em 0.3em;
    font-size: 32px;
    line-height: 1em;
    color: var(--sub-color);
    border-bottom: 2px solid transparent;

    // user-select: none;
    & span {
      display: inline-block;
    }

    &:has(.incorrect) {
      border-bottom: 2px solid var(--error-color);
    }

    &:has(.over-incorrect) {
      border-bottom: 2px solid var(--error-extra-color) !important;
    }
  }

  .tab-character::before {
    content: '→';
  }

  .newline-character::before {
    content: '↵';
  }

  .active {
    position: relative;
  }
</style>
