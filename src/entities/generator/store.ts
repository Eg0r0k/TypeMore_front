import { nthElementFromArray, RandomElementFromArray, shuffle } from '@/shared/lib/helpers/arrays'
import { useConfigStore } from '../config/store'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { useTestStateStore } from '../test'

export const useWordGeneratorStore = defineStore('word-gen', () => {
  const { config } = useConfigStore()
  const shuffedIndexes = ref<number[]>([])
  const testState = useTestStateStore()
  const previousWords = ref([])
  const words = ref([])
  const currentLanguage = ref(config.language.split('-')[0])
  const retWords: ret = reactive({
    words: [],
    sectionIndexes: [],
    hasTab: false,
    hasNewline: false
  })

  interface ret {
    words: string[]
    sectionIndexes: number[]
    hasTab: boolean
    hasNewline: boolean
  }
  const getWordsLimit = (): number => {
    const limit = 100
    if (config.mode === 'free') {
      return 0
    }

    return limit
  }

  const generateWords = (lang: any) => {
    if (!testState.isRepeated) {
      previousWords.value = []
    }
    currentLanguage.value = lang.language
    const wordList = lang.words
    const limit = getWordsLimit()
    let i = 0
    let stop = false
    while (!stop) {
      const nextWord = getNextWord(
        i,
        limit,
        nthElementFromArray(retWords.words, -1) ?? '',
        nthElementFromArray(retWords.words, -2) ?? ''
      )
      retWords.words.push(nextWord)
    }
  }

  const getRandomWord = (): string => {
    return RandomElementFromArray(words.value)
  }

  const getNextWord = (
    wordIndex: number,
    wordLimit: number,
    previousWord: string,
    previousWord2: string
  ) => {
    if (currentLanguage.value === null) {
      throw new Error('Language not set')
    }
    const randomWord = getRandomWord()
    return randomWord
  }

  const shuffleWords = () => {
    if (shuffedIndexes.value.length === 0) {
      generateShuffledIndexes()
    }
    return words.value[shuffedIndexes.value.pop() as number] as string
  }
  const generateShuffledIndexes = () => {
    shuffedIndexes.value = []
    for (let i = 0; i < words.value.length; i++) {
      shuffedIndexes.value.push(i)
    }
    shuffle(shuffedIndexes.value)
  }

  return { getWordsLimit, generateWords, shuffleWords }
})
