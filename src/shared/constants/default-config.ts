import { Config } from './type'

export default {
  devTools: false,
  words: 50,
  time: 10,
  fontSize: 16,
  fontFamily: 'Hack',
  language: 'russian',
  showKeyboard: false,
  theme: 'VS Code',
  mode: 'time',
  backgroundImg: '',
  showFps: true,
  playSound: true,
  soundVolume: 0.5
} as const as Config
