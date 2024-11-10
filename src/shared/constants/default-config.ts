import { Config } from './type'

export default {
  words: 50,
  time: 10,
  fontSize: 16,
  language: 'russian',
  theme: 'VS Code',
  mode: 'time',
  backgroundImg: '',
  showFps: true,
  playSound: true,
  soundVolume: 0.5
} as const as Config
