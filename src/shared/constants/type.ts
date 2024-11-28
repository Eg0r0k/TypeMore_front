export interface Config {
  words: number
  devTools: boolean
  time: number
  language: string
  theme: string
  mode: 'words' | 'free' | 'time'
  backgroundImg: string
  showFps: boolean
  playSound: boolean
  soundVolume: number
  fontSize: number
  fontFamily: string
}
