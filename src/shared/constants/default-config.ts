import { ConfigModes, type Config } from './type'
import { DEFAULT_ERROR_SOUND_PACK, DEFAULT_SOUND_PACK } from './sound-packs'

/**
 * The factory settings.
 *
 * `as const satisfies Config` rather than `as const as Config`: the literal
 * types have to survive, because the option registry checks at COMPILE TIME
 * that every preset-backed default is one the player can actually pick
 * (`_PresetDefaultsAreSelectable`). `satisfies` still type-checks every field
 * against `Config` — nothing is loosened, the literals are simply kept.
 */
export default {
  devTools: false,
  words: 50,
  // One of the durations the rail offers (registry: [15, 30, 60, 120]). It used
  // to be 10, which is in no preset: after `resetSettings` the rail highlighted
  // nothing and the run quietly lasted 10 seconds. `validateConfig` cannot catch
  // that — it only asks for a positive integer.
  time: 15,
  // The words shadow styles are drawn against 32px (see game-styles.ts).
  fontSize: 32,
  fontFamily: 'Mononoki',
  language: 'russian',
  uiLanguage: 'system',
  showKeyboard: false,
  theme: 'VS Code',
  // The enum member, not the string: `satisfies` checks against `ConfigModes`,
  // and a bare literal is not assignable to a TS enum type.
  mode: ConfigModes.Time,
  backgroundImg: '',
  backgroundLocal: '',
  backgroundSize: 'cover',
  showFps: false,
  playSound: true,
  soundVolume: 0.5,
  soundSet: DEFAULT_SOUND_PACK,
  errorSoundSet: DEFAULT_ERROR_SOUND_PACK,
  punctuation: false,
  numbers: false,
  randomCase: false,
  nospace: false,
  difficulty: 'normal',
  blind: false,
  reverse: false,
  lazy: false,
  quoteGroup: 'all',
  minWpm: 0,
  fading: false,
  flashlight: false,
  freedomMode: false,
  stopOnError: 'off',
  quickEnd: false,
  smoothCaret: 'medium',
  caretStyle: 'default',
  paceCaret: 'off',
  paceCaretWpm: 100
} as const satisfies Config
