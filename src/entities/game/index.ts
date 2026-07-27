export { useGameStore, releaseGameStore } from './model/store'
export type { GameSetup, GameStore, ReplayData } from './model/store'
export { toGameSession, withBlind } from './model/view'
export type { GameView, GameInputSink, GameSession } from './model/view'
export { toCoreSetup, plannedMultiplier } from './model/settings'
export type { GameSettings, CoreSetup } from './model/settings'
export { wordsHaveTab, wordsHaveNewline, wordBreaksLine } from './lib/whitespace'
export {
  GAME_OPTIONS,
  OPTION_CONTEXTS,
  QUOTE_PROBE,
  emitsFixedText,
  optionOf,
  optionsFor,
  valuesFor,
  presetsFor,
  isVisible,
  disabledReason,
  visibleOptionsFor
} from './config/registry'
export { OPTION_ICONS, modeIconOf } from './config/icons'
export { ModGroup } from './ui/mod-group'
export type {
  GameOption,
  GameOptionKey,
  AppOnlyConfigKey,
  OptionContext,
  OptionContexts,
  OptionControl,
  OptionSlot,
  OptionDescriptor,
  ConstraintContext,
  DisabledReason
} from './config/registry'
