import { shuffle } from '@/shared/lib/helpers/arrays'
import { useConfigStore } from '../../config/model/store'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useTestStateStore } from '../../test'

import { logRandomIndex } from '@/shared/lib/helpers/misc'
import { getLastChar } from '@/shared/lib/helpers/string'
import { LanguageObj, QuoteData, QuoteWithTextSplit } from '@/shared/lib/types/types'

interface RetWords {
  words: string[]
  sectionIndexes: number[]
  hasTab: boolean
  hasNewline: boolean
}

//TODO: Make generator for quotes, and generator limit for optimisation
export const useWordGeneratorStore = defineStore('word-gen', () => {
  const { config } = useConfigStore()
  const testState = useTestStateStore()
  const limit = ref(100)
  const retWords: RetWords = reactive({
    words: [],
    sectionIndexes: [],
    hasTab: false,
    hasNewline: false
  })
  const wordLimit = computed(() =>
    config.mode === 'free' && config.words <= 0 ? 100 : config.words
  )

  const getWordsLimit = (): number => {
    if (config.mode === 'free' && config.words === 0) {
      return limit.value
    }
    return config.words
  }

  const punctuateWords = () => {
    retWords.words = retWords.words.map((word, index) => applyPunctuation(word, index))
  }
  const applyPunctuation = (word: string, index: number): string => {
    const punctuations = ['', '.', ',', '!', '?']
    return (
      word +
      (Math.random() < 0.3 ? punctuations[Math.floor(Math.random() * punctuations.length)] : '')
    )
  }

  const reset = () => {
    retWords.words = []
    retWords.sectionIndexes = []
    retWords.hasTab = false
    retWords.hasNewline = false
  }
  const removeWords = (from: number, to: number) => {
    const numToRemove = Math.min(to - from + 1, retWords.words.length - from)
    retWords.words.splice(from, numToRemove)
  }
  const getQuoteLimit = (quote: QuoteWithTextSplit): number => {
    return quote.textSplit.length
  }
  const getCurrent = (): string => {
    return retWords.words[testState.currentWordElementIndex] ?? ''
  }
  const splitText = (text: string): string[] => text.split(/\s+/)

  const generateQuotes = (quoteData: QuoteData) => {
    reset()
    const parsedQuotes = quoteData.quotes.map((quote) => splitText(quote.text))
    parsedQuotes.forEach((wordsArray) => addWords(wordsArray))
  }
  const addWords = (newWords: string[]) => {
    const availableLimit = Math.min(wordLimit.value, newWords.length)
    retWords.words = [...retWords.words, ...newWords.slice(0, availableLimit)]
  }

  const generateWords = (lang: LanguageObj) => {
    reset()
    const limit = wordLimit.value
    retWords.words = lang.words.slice(0, limit)
  }

  return {
    getWordsLimit,
    retWords,
    generateWords,
    generateQuotes,
    getCurrent,
    addWords,
    reset,
    removeWords
  }
})
