import { shuffle } from '@/shared/lib/helpers/arrays'
import { useConfigStore } from '../../config/model/store'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useTestStateStore } from '../../test'
import { LanguageObj } from '@/shared/constants/type'
import { logRandomIndex } from '@/shared/lib/helpers/misc'

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
  const reset = () => {
    retWords.words = []
  }

  const generateWords = async (lang: LanguageObj) => {
    if (testState.isRepeated) {
      return
    }
    const shuffledWords = [...lang.words]

    let stop = false
    const limit = config.words
    let i = 0
    while (!stop) {
      const nextWord = getNextWord(lang, limit, i)
      retWords.words.push(nextWord)
      if (retWords.words.length >= limit) {
        stop = true
      }
      i++
    }
  }
  const getCurrent = (): string => {
    console.log(testState.currentWordElementIndex)
    return retWords.words[testState.currentWordElementIndex] ?? ''
  }

  const getNextWord = (lang: LanguageObj, limit: number, index: number) => {
    console.debug('Generated word: ', {
      isRepeated: testState.isRepeated,
      lang: currentLanguage
    })
    const randomWord = lang.words[logRandomIndex(lang.words.length)]
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

  return { getWordsLimit, shuffleWords, retWords, generateWords, getCurrent, words, reset }
})
