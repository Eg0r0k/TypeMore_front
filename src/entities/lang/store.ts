import { defineStore } from 'pinia'
import { useConfigStore } from '../config/store'
import { computed, ref } from 'vue'

export const useLangStore = defineStore('lang', () => {
  const words = ref<string[]>([])
  const { config } = useConfigStore()
  // const setLang = (lang = config.language):Promise<void> => {
  //   const lang = computed(()=>{

  //   })
  // }

  return words
})
