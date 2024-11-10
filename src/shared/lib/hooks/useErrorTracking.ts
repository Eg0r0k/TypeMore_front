import { ref } from 'vue'

interface ErrorHistoryObject {
  count: number
  words: string[]
}

export const useErrorTracking = () => {
  const missedWords = ref<Record<string, number>>({})
  const errorHistory = ref<ErrorHistoryObject>({ count: 0, words: [] })
  const pushMissedWords = (word: string): void => {
    missedWords.value[word] = (missedWords.value[word] || 0) + 1
  }

  const incrementKeypressErrors = () => {
    errorHistory.value.count++
  }
  const resetMissedWords = (): void => {
    missedWords.value = {}
  }
  const resetErrorHistory = (): void => {
    errorHistory.value = { count: 0, words: [] }
  }
  return {
    missedWords,
    resetErrorHistory,
    resetMissedWords,

    errorHistory,
    pushMissedWords,
    incrementKeypressErrors
  }
}
