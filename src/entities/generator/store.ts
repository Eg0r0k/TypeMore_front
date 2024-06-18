import { shuffle } from '@/shared/lib/helpers/arrays'
import { useConfigStore } from '../config/store'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useTestStateStore } from '../test'
import { LanguageObj } from '@/shared/constants/type'

export const useWordGeneratorStore = defineStore('word-gen', () => {
  const { config } = useConfigStore()
  const testState = useTestStateStore()
  const shuffedIndexes = ref<number[]>([])
  const words = ref<any>([])
  const limit = ref(100)

  const currentLanguage = computed(() => config.language.split('_')[0])
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
  const getLastChar = (word: string): string => {
    try {
      return word.charAt(word.length - 1)
    } catch {
      return ''
    }
  }
  const punctuateWord = (previusWord: string, currentWord: string) => {
    const lastChar = getLastChar(previusWord)
  }
  function capitalizeFirstLetterOfEachWord(str: string): string {
    return str
      .split(/ +/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
  }
  const generateWords = async (lang: LanguageObj) => {
    if (testState.isRepeated) {
      return
    }

    const shuffledWords = [...lang.words]
    const punctuationBox: string[] = ['.', ',', '!', '?', ':', ';', '-']

    for (let i = shuffledWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]]

      if (Math.random() < 0.2) {
        shuffledWords[i] += punctuationBox[Math.floor(Math.random() * punctuationBox.length)]
      }
    }

    words.value = shuffledWords // Присваиваем сгенерированные слова
  }
  const getCurrent = (): string => {
    return words.value[testState.currentWordElementIndex] ?? ''
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

  return { getWordsLimit, shuffleWords, retWords, generateWords, getCurrent, words }
})
