/**
 * Public API of the replay-view feature. Consumers (the `/replay/:runId` page)
 * import ONLY from here. Turns the server's public replay pair into the
 * `ReplayData` the player renders.
 */
export { quoteRefOf, replayFromApi } from './model/replay-from-api'
export type {
  ReplayFromApiError,
  ReplayFromApiErrorKind,
  ReplayTextSource
} from './model/replay-from-api'
export { replayResults } from './model/replay-results'
export type { ReplayResults } from './model/replay-results'
export { useReplaySource } from './model/use-replay-source'
export type { ReplaySource, ReplaySourceState } from './model/use-replay-source'
