import * as v from 'valibot'
import type { RoomDimension } from './types'

/**
 * Layer 1 — Public room list schemas. Field names mirror the JSON of
 * `GET /rooms`, field for field.
 *
 * This is a DISCOVERY view of a room, not the room itself: it carries what a
 * browser needs to decide whether to walk in, and nothing that would let a
 * client reconstruct the lobby without joining it. The full room shape is the
 * `room_state` frame over the socket (PROTOCOL §5), which is a different thing
 * and stays where it is.
 */

/**
 * The settings slice a listing exposes.
 *
 * The dimension arrives under the name its mode gives it — `durationMs` for
 * `time`, `wordCount` for `words` — exactly as PROTOCOL §5 defines room
 * settings and as the leaderboard catalogue already does it. Both are optional
 * on the wire because neither is universal, but they are MUTUALLY EXCLUSIVE:
 * a payload carrying both, or neither, describes no mode this client knows.
 *
 * The exclusivity is checked rather than merely documented because the
 * alternative is a `?? 0` at every read site — a room silently rendered as
 * "0 words" is worse than a list that says out loud that the server broke its
 * own contract.
 */
export const RoomListSettingsSchema = v.pipe(
  v.object({
    mode: v.picklist(['time', 'words', 'quote']),
    /** Present for `time` mode, absent otherwise. */
    durationMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    /** Present for the counted modes (`words`, `quote`), absent otherwise. */
    wordCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    /** The canonical dictionary key. Never a display name — see `useLanguageNames`. */
    lang: v.string()
  }),
  v.check(
    (settings) =>
      settings.mode === 'time'
        ? settings.durationMs !== undefined && settings.wordCount === undefined
        : settings.wordCount !== undefined && settings.durationMs === undefined,
    'A room carries exactly the dimension its mode names: durationMs for time, wordCount for the counted modes'
  )
)
export type RoomListSettings = v.InferOutput<typeof RoomListSettingsSchema>

/**
 * One open room. `code` is the same 6-char join code the join-by-code modal
 * takes, which is what makes a row clickable at all: discovery and join share
 * one path rather than growing a second one.
 *
 * `inMatch` is the room's phase, not a seat count — a running room is full in
 * the only sense that matters even when a seat is free, because §5 admits no
 * mid-match joins.
 */
export const RoomListEntrySchema = v.object({
  code: v.string(),
  name: v.string(),
  playerCount: v.number(),
  maxPlayers: v.number(),
  inMatch: v.boolean(),
  settings: RoomListSettingsSchema
})
export type RoomListEntry = v.InferOutput<typeof RoomListEntrySchema>

/**
 * `GET /rooms`. Envelope-wrapped like `{ buckets }` and `{ quotes }`, so the
 * response has somewhere to grow a cursor without becoming a different shape.
 *
 * Private rooms are absent server-side, in any state — the client never
 * receives them and so cannot leak one by filtering wrongly. Order is the
 * server's (busiest first, then oldest first) and is preserved as received.
 */
export const RoomListSchema = v.object({
  rooms: v.array(RoomListEntrySchema)
})
export type RoomList = v.InferOutput<typeof RoomListSchema>

/**
 * Narrows the two optionals into the one that is actually there.
 *
 * It exists so that no view has to restate the mode/field correspondence, the
 * way `isQuoteBucket` keeps bucket discrimination in one place. `null` is the
 * total function's answer for a pairing the schema above already rejects —
 * kept rather than asserted away, because a cast that is only correct as long
 * as a validator elsewhere stays correct is not a guarantee, it is a bet.
 */
export const roomDimension = (settings: RoomListSettings): RoomDimension | null => {
  const { durationMs, wordCount } = settings
  if (settings.mode === 'quote') return { kind: 'quote' }
  if (settings.mode === 'time' && durationMs !== undefined) return { kind: 'time', durationMs }
  if (settings.mode === 'words' && wordCount !== undefined) return { kind: 'words', wordCount }
  return null
}
