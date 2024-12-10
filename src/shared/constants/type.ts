export interface Config {
  words: number
  devTools: boolean
  time: number
  language: string
  theme: string
  mode: ConfigModes
  backgroundImg: string
  showFps: boolean
  playSound: boolean
  showKeyboard: boolean
  soundVolume: number
  fontSize: number
  fontFamily: string
}

export enum ConfigModes {
  Words = 'words',
  Free = 'free',
  Time = 'time',
  Qoute = 'quote',
  Custom = 'custom'
}
