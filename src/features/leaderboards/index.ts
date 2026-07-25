/**
 * Leaderboards feature — public surface.
 *
 * The page composes the picker and the board, and owns only what crosses them:
 * which bucket is selected, which lives in the URL. Paging, own-rank and the
 * mod projection stay behind their components — nothing outside the feature has
 * asked for them, and an export nobody consumes is a contract nobody checks.
 */
export { BoardBucketPicker } from './bucket-picker'
export { BoardTable } from './board-table'
export { BoardView } from './board-view'
export { BoardModChips } from './mod-chips'

export { useBucketSelection } from './model/use-bucket-selection'
export type { BucketSelection } from './model/use-bucket-selection'
