import { nthElementFromArray, RandomElementFromArray, shuffle } from '@/shared/lib/helpers/arrays'
import { useConfigStore } from '../config/store'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { useTestStateStore } from '../test'
import { LanguageObj } from '@/shared/constants/type'

export const useWordGeneratorStore = defineStore('word-gen', () => {
  const { config } = useConfigStore()
  const shuffedIndexes = ref<number[]>([])
  const testState = useTestStateStore()
  const words = ref([])
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
  const getWordsLimit = (): number => {
    const limit = 100
    if (config.mode === 'free' && config.words === 0) {
      return limit
    }

    return limit
  }
  const generateWords = async (lang: LanguageObj): Promise<LanguageObj> => {
    if (!testState.isRepeated) {
      throw Error('test is')
    }
    
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

  return { getWordsLimit, shuffleWords }
})
