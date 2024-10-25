<template>
  <div ref="wordsContainer" class="words" :class="{ rightToLeft: props.isRightToLeft }">
    <template v-for="(word, wordIndex) in generator.retWords.words" :key="`${word}-${wordIndex}`">
      <p
        ref="wordElements"
        class="word"
        :class="{ active: wordIndex === testState.currentWordElementIndex }"
      >
        <span
          v-for="(letter, letterIndex) in word"
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
  </div>
  <div class="character-stats"></div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@/entities/input/model'
import { useTestStateStore } from '@/entities/test'
import { useStats } from '@/shared/lib/hooks/useStats'
import { useAccuracy } from '@/shared/lib/hooks/useAccuracy'
const { accuracy, accuracyPercentage, incrementAccuracy } = useAccuracy()

interface Props {
  isRightToLeft?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isRightToLeft: false
})

const inputStore = useInputStore()
const testState = useTestStateStore()
const generator = useWordGeneratorStore()

const wordsContainer = ref<HTMLDivElement | null>(null)
const maxLines = 3

const calculateHeights = () => {
  const words = wordsContainer.value?.querySelectorAll('.word') || []
  if (words.length === 0) return

  const wordComputedStyle = window.getComputedStyle(words[0] as Element)
  const lineHeight = parseFloat(wordComputedStyle.lineHeight) || 0
  const wordTopMargin = parseFloat(wordComputedStyle.marginTop) || 0
  const wordBottomMargin = parseFloat(wordComputedStyle.marginBottom) || 0

  const maxHeight = (lineHeight + wordTopMargin + wordBottomMargin) * maxLines

  wordsContainer.value!.style.height = `${maxHeight}px`
  wordsContainer.value!.style.overflow = 'hidden'
}
const updateHeights = async () => {
  await nextTick(() => {
    calculateHeights()
  })
}

onMounted(async () => {
  updateHeights()
})

watch(
  () => generator.retWords.words,
  () => {
    updateHeights()
  },
  { immediate: true }
)
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

.rightToLeft {
  direction: rtl;
}

.caret {
  height: 1.2em;
  background-color: var(--main-color);
  position: absolute;
  transform-origin: top left;
  border-radius: var(--border-radius);
  font-size: 2rem;
  top: 0;
  transition: left 0.1s ease;
  left: 0;
  opacity: 1;
  width: 2px;
  animation: caretBlink 1s infinite;
}

.words {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  align-content: flex-start;
  overflow: hidden;
}

.active {
  position: relative;

  /*&::before {
        content: "";
        position: absolute;
        left: -5px;
        height: 100%;
        width: 3px;
        animation: caretFlashSmooth 1s infinite;
        background-color: red;
    }
        */
}

.word {
  position: relative;
  font-size: 32px;
  line-height: 1em;
  margin: 0.25em 0.3em;
  border-bottom: 2px solid transparent;
  color: var(--sub-color);
  //user-select: none;

  &:has(.over-incorrect) {
    border-bottom: 2px solid var(--error-extra-color) !important;
  }

  &:has(.incorrect) {
    border-bottom: 2px solid var(--error-color);
  }
}
</style>
