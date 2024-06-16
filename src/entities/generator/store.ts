import { shuffle } from '@/shared/lib/helpers/arrays'
import { useConfigStore } from '../config/store'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { useTestStateStore } from '../test'
import { LanguageObj } from '@/shared/constants/type'

export const useWordGeneratorStore = defineStore('word-gen', () => {
  const { config } = useConfigStore()
  const testState = useTestStateStore()
  const shuffedIndexes = ref<number[]>([])
  const words = ref([])
  const limit = ref(100)

  const currentLanguage = ref(config.language.split('_')[0])
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
  //Limit of first generated words
  const getWordsLimit = (): number => {
    if (config.mode === 'free' && config.words === 0) {
      return limit.value
    }
    return limit.value
  }
  const generateWords = async (lang: LanguageObj) => {
    if (testState.isRepeated) {
      return []
    }

    const shuffledWords = [...lang.words]

    for (let i = shuffledWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]]
    }

    return shuffledWords
  }

  const getNextWord = (
    wordIndex: number,
    wordLimit: number,
    previusWord1: string,
    previusWord2: string
  ) => {
    console.debug('Generated word: ', {
      isRepeated: testState.isRepeated,
      wordIndex,
      previusWord1,
      lang: currentLanguage,
      previusWord2
    })
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

  return { getWordsLimit, shuffleWords, retWords, generateWords }
})
