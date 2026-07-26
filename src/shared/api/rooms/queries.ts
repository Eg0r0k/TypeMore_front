import { queryOptions } from '@tanstack/vue-query'
import { listRooms } from './endpoints'
import { roomKeys } from './keys'
import type { RoomList } from './schemas'

/**
 * Layer 2 — Public room list server state.
 *
 * A lobby list is stale the instant it is read: seats fill, matches start,
 * rooms die when their last player leaves. So there is no `staleTime` here —
 * the default `0` is the honest answer, and freshness comes from POLLING, which
 * the view owns because only the view knows whether anyone is looking.
 */

/**
 * Poll cadence. Four seconds is short enough that a room that just filled is
 * not clicked twice, and long enough that an idle browser tab is not a
 * request-per-second heartbeat. The view multiplies this by document
 * visibility — see the lobby feature.
 */
export const ROOM_LIST_POLL_MS = 4000

export const roomListQueryOptions = () =>
  queryOptions({
    queryKey: roomKeys.list(),
    queryFn: () => listRooms(),
    select: (list: RoomList) => list.rooms
  })
