<template>
  <div ref="wordsContainer" :class="classes">
    <template v-for="(word, wordIndex) in generator.retWords.words" :key="`${word}-${wordIndex}`">
      <TestWord :word="word" :wordIndex="wordIndex + currentIndex" />
    </template>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted, watch, nextTick, computed } from 'vue'
  import { useWordGeneratorStore } from '@/entities/generator/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'

  import { TestWord } from '@/features/test/word'
  import { useLineJump } from '@/shared/lib/hooks/useLineJump'
  import clsx from 'clsx'
  const generator = useWordGeneratorStore()
  //TODO: END THIS SHIT
  //!
  const MAX_LINES = 3

  interface Props {
    isRightToLeft?: boolean
  }

  // const showedWords = ref<string[]>([])
  const currentIndex = ref(0)
  const classes = computed(() => clsx('words', { 'right-to-left': props.isRightToLeft }))
  const props = withDefaults(defineProps<Props>(), {
    isRightToLeft: false
  })

  // const clearWords = () => {
  //   let temp = testState.currentWordElementIndex - 3
  //   if (temp < 0) temp = 0
  //   currentIndex.value = temp
  //   showedWords.value = unref(generator.retWords.words).slice(
  //     temp,
  //     testState.currentWordElementIndex + 7
  //   )
  // }

  const testState = useTestStateStore()

  const wordsContainer = ref<HTMLDivElement | null>(null)

  const { lineJump } = useLineJump(wordsContainer)
  const calculateHeights = () => {
    const words = wordsContainer.value?.querySelectorAll('.word') || []
    if (words.length === 0) return

    const wordComputedStyle = window.getComputedStyle(words[0] as Element)
    const lineHeight = parseFloat(wordComputedStyle.lineHeight) || 0
    const wordTopMargin = parseFloat(wordComputedStyle.marginTop) || 0
    const wordBottomMargin = parseFloat(wordComputedStyle.marginBottom) || 0

    const maxHeight = (lineHeight + wordTopMargin + wordBottomMargin) * MAX_LINES

    wordsContainer.value!.style.height = `${maxHeight}px`
    wordsContainer.value!.style.overflow = 'hidden'
  }
  const updateHeights = async () => {
    await nextTick(() => {
      calculateHeights()
    })
  }
  const checkLineJump = () => {
    const words = wordsContainer.value?.querySelectorAll<HTMLElement>('.word')
    if (!words || testState.currentWordElementIndex === 0) return

    const currentTop = Math.floor(words[testState.currentWordElementIndex - 1]?.offsetTop ?? 0)
    let nextTop: number

    try {
      nextTop = Math.floor(words[testState.currentWordElementIndex]?.offsetTop ?? 0)
    } catch (e) {
      console.error(e)
      nextTop = 0
    }

    if (nextTop > currentTop) {
      console.log('JUMP')
      lineJump(currentTop)
    }
  }
  onMounted(async () => {
    updateHeights()
  })

  watch([() => testState.currentWordElementIndex], () => {
    checkLineJump()
  })

  watch(
    () => generator.retWords.words,
    () => {
      updateHeights()
    },
    { immediate: true }
  )
  // watch([() => testState.currentWordElementIndex], () => {
  //   clearWords()
  // })
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

  .right-to-left {
    direction: rtl;
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    width: 100%;
    height: fit-content;
    padding-bottom: 1em;
    overflow: hidden;
    overflow: visible clip;
  }

  .word {
    position: relative;
    margin: 0.25em 0.3em;
    font-size: 32px;
    line-height: 1em;
    color: var(--sub-color);
    border-bottom: 2px solid transparent;
  }

  .active {
    position: relative;
  }
</style>
