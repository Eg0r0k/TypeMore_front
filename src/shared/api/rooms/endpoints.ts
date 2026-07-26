import { request } from '../transport'
import { RoomListSchema, type RoomList } from './schemas'

/**
 * Layer 1 — Public room list. One endpoint, and deliberately only one.
 *
 * Everything else a room can be asked or told goes over the match socket
 * (PROTOCOL §5). This exists because discovery is the single thing a browser
 * needs BEFORE it holds a seat, and opening a websocket to read a list would
 * be a connection per glance.
 */

/** `GET /rooms` — every open room. Public: no auth, no session, no cookie. */
export const listRooms = (): Promise<RoomList> => request('/rooms', RoomListSchema)
