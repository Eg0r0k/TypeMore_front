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
