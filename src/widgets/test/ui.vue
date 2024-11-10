<template>
  <div ref="wordsContainer" class="words" :class="{ rightToLeft: props.isRightToLeft }">
    <template v-for="(word, wordIndex) in generator.retWords.words" :key="`${word}-${wordIndex}`">
      <TestWord :word="word" :wordIndex="wordIndex" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@/entities/input/model'
import { useTestStateStore } from '@/entities/test'

import { useScrollTape } from '@/shared/lib/hooks/useScrollTape'
import { TestWord } from '@/features/test/word'

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

const { scrollTape } = useScrollTape(wordsContainer)
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
  [
    () => testState.currentWordElementIndex,
    () => inputStore.input.current,
    () => generator.retWords.words
  ],
  () => {
    //
  }
)

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

.words {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  align-content: flex-start;
  overflow: hidden;
}

.word {
  position: relative;
  font-size: 32px;
  line-height: 1em;
  margin: 0.25em 0.3em;
  border-bottom: 2px solid transparent;
  color: var(--sub-color);
}

.active {
  position: relative;
}
</style>
