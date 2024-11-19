import { ref } from 'vue'

interface ErrorHistoryObject {
  count: number
  words: string[]
}

export const useErrorHistory = () => {
  const errorHistory = ref<ErrorHistoryObject>({ count: 0, words: [] })
  const incrementKeypressErrors = (): void => {
    errorHistory.value.count++
  }
  const resetErrorHistory = (): void => {
    errorHistory.value = { count: 0, words: [] }
  }
  const addWordToHistory = (word: string): void => {
    if (!errorHistory.value.words.includes(word)) {
      errorHistory.value.words.push(word)
    }
  }

  return {
    errorHistory,
    incrementKeypressErrors,
    resetErrorHistory,
    addWordToHistory
  }
}
export const useMissedWords = () => {
  const missedWords = ref<Record<string, number>>({})
  const pushMissedWord = (word: string): void => {
    missedWords.value[word] = (missedWords.value[word] || 0) + 1
  }

  const resetMissedWords = (): void => {
    missedWords.value = {}
  }

  return {
    missedWords,
    pushMissedWord,
    resetMissedWords
  }
}

export const useErrorTracking = () => {
  const missedWords = useMissedWords()
  const errorHistory = useErrorHistory()

  const pushMissedWordWithHistory = (word: string): void => {
    missedWords.pushMissedWord(word)
    errorHistory.addWordToHistory(word)
  }

  const resetAllErrors = (): void => {
    missedWords.resetMissedWords()
    errorHistory.resetErrorHistory()
  }

  return {
    ...missedWords,
    ...errorHistory,
    pushMissedWordWithHistory,
    resetAllErrors
  }
}
