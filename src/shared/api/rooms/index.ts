/** Rooms domain — public surface. */
export { roomKeys } from './keys'
export { ROOM_LIST_POLL_MS, roomListQueryOptions } from './queries'

export {
  roomDimension,
  RoomListSettingsSchema,
  RoomListEntrySchema,
  RoomListSchema
} from './schemas'
export type { RoomListSettings, RoomListEntry, RoomList } from './schemas'
export type { RoomDimension } from './types'
