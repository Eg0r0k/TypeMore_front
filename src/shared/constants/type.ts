export interface Config {
  words: number
  time: number
  language: string
  theme: string
  mode: 'words' | 'free' | 'time'
  backgroundImg: string
  showFps: boolean
}

export type LanguageObj = {
  name: string
  rightToleft: boolean
  words: string[]
  bcp47?: string
}
