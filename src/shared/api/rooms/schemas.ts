import * as v from 'valibot'
import logger from '@/shared/lib/helpers/logger'
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
 * "0 words" is worse than a room that is dropped with the breach logged out
 * loud (see RoomListSchema for the per-entry tolerance).
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
 *
 * Entries are validated ONE BY ONE and a contract-breaking entry is dropped
 * with a logged warning rather than failing the whole response. The envelope
 * itself is still strict — `rooms` missing or non-array is a broken response,
 * not a broken room. The tolerance exists because the failure unit of this
 * list is a room: one malformed listing (a stale server has shipped quote
 * rooms with no dimension) should not blank every healthy room a player could
 * have walked into.
 */
export const RoomListSchema = v.pipe(
  v.object({ rooms: v.array(v.unknown()) }),
  v.transform(({ rooms }) => ({
    rooms: rooms.flatMap((raw): RoomListEntry[] => {
      const parsed = v.safeParse(RoomListEntrySchema, raw)
      if (parsed.success) return [parsed.output]
      logger.warn('room list entry breaks the contract; dropping it', {
        entry: raw,
        issues: v.flatten<typeof RoomListEntrySchema>(parsed.issues)
      })
      return []
    })
  }))
)
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
