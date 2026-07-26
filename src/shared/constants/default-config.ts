import type { Config } from './type'
import { DEFAULT_SOUND_PACK } from './sound-packs'

export default {
  devTools: false,
  words: 50,
  time: 10,
  // The words shadow styles are drawn against 32px (see game-styles.ts).
  fontSize: 32,
  fontFamily: 'Hack',
  language: 'russian',
  uiLanguage: 'system',
  showKeyboard: false,
  theme: 'VS Code',
  mode: 'time',
  backgroundImg: '',
  backgroundLocal: '',
  backgroundSize: 'cover',
  showFps: true,
  playSound: true,
  soundVolume: 0.5,
  soundSet: DEFAULT_SOUND_PACK,
  punctuation: false,
  numbers: false,
  randomCase: false,
  nospace: false,
  difficulty: 'normal',
  blind: false,
  reverse: false,
  quoteGroup: 'all',
  minWpm: 0,
  fading: false,
  flashlight: false,
  freedomMode: false,
  stopOnError: 'off',
  quickEnd: false,
  smoothCaret: 'medium',
  caretStyle: 'default'
} as const as Config
