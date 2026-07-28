/**
 * Leaderboards feature — public surface.
 *
 * The page composes the rail and the board, and owns only what crosses them:
 * which board/language/source/filter is selected, all of which lives in the
 * URL. Paging, own-rank and the mod projection stay behind their components —
 * nothing outside the feature has asked for them, and an export nobody
 * consumes is a contract nobody checks.
 */
export { BoardRail } from './rail'
export { BoardTable } from './board-table'
export { BoardView } from './board-view'
export { BoardModChips } from './mod-chips'
export { QuoteBoardHeader } from './quote-board'

export { useBoardsSelection } from './model/use-boards-selection'
export type {
  BoardsSelection,
  BoardsSource,
  BoardsView,
  QuoteGroupFilter
} from './model/use-boards-selection'
export { railLanguages, railVariations, bucketForLanguage } from './model/rail'
export type { RailLanguage, RailVariation } from './model/rail'
