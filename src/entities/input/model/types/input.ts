import { ComputedRef } from 'vue'
export interface InputRaw {
  current: string
  history: string[]
}

export interface Input extends InputRaw {
  historyLength: ComputedRef<number>
  length: ComputedRef<number>
}
