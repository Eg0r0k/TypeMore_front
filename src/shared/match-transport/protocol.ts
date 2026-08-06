import * as v from 'valibot'
import { Result, err, ok } from 'neverthrow'

/**
 * Wire contract for the TypeMore realtime protocol v1 (TypeMore_back/docs/PROTOCOL.md).
 *
 * Every schema here mirrors the protocol document verbatim; mismatches between
 * a received frame and its schema are surfaced as `protocol-violation`
 * transport events — never silently adapted. `v.object` tolerates (and strips)
 * unknown extra fields, which is the forward-compatibility stance the protocol
 * requires for additive server changes.
 */

/** Protocol version announced in `hello`. Numeric per PROTOCOL.md §1. */
export const PROTOCOL_VERSION = 1 as const

// ── Shared shapes (§5) ──────────────────────────────────────────────────────

const TextModsSchema = v.object({
  punctuation: v.boolean(),
  numbers: v.boolean(),
  randomCase: v.boolean(),
  reverse: v.boolean(),
  /**
   * Lazy mode — the generated words without their diacritics (`épée` → `epee`).
   * Defaulted rather than required: it was added to §5 after the field set was
   * frozen, and a server or a peer that predates it says nothing, which must
   * decode as the old behaviour rather than fail the frame.
   */
  lazy: v.optional(v.boolean(), false)
})
export type TextMods = v.InferOutput<typeof TextModsSchema>

/**
 * `seeded` (server seed + dictionary) or `quote` (one published text, by id).
 * Still a LOOSE object with a free-form `kind`: the protocol grows text sources
 * additively with no version bump (§5), so an unknown kind must survive
 * validation and reach the code that can report it rather than fail the frame.
 */
const TextSourceSchema = v.looseObject({
  kind: v.string(),
  /** Present for `kind: 'quote'` — the id `GET /quotes/{id}` resolves. */
  quoteId: v.optional(v.string())
})
export type TextSource = v.InferOutput<typeof TextSourceSchema>

const RoomSettingsSchema = v.object({
  name: v.string(),
  visibility: v.picklist(['open', 'private']),
  mode: v.picklist(['time', 'words', 'quote']),
  /** Present for `time` mode. */
  durationMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  /** Present for `words` and `quote` mode; for a quote, the drawn text's length. */
  wordCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  lang: v.string(),
  /** Empty for a quote match: a quote has no dictionary to fingerprint. */
  dictHash: v.string(),
  textMods: TextModsSchema,
  textSource: TextSourceSchema
})
export type RoomSettings = v.InferOutput<typeof RoomSettingsSchema>

const FreemodsSchema = v.object({
  difficulty: v.picklist(['normal', 'expert', 'master']),
  minWpm: v.picklist([0, 60, 80, 100]),
  nospace: v.boolean()
})
export type Freemods = v.InferOutput<typeof FreemodsSchema>

const RoomPlayerSchema = v.object({
  playerId: v.string(),
  nick: v.string(),
  isGuest: v.boolean(),
  ready: v.boolean(),
  freemods: FreemodsSchema
})
export type RoomPlayer = v.InferOutput<typeof RoomPlayerSchema>

const ERROR_CODES = [
  'version_mismatch',
  'bad_message',
  'room_not_found',
  'room_full',
  'not_in_room',
  'forbidden',
  'not_ready',
  'rate_limited',
  // A banned account's create_room/join_room refusal (docs/MODERATION.md) —
  // the same machine code the run-submission gate answers with.
  'account_restricted',
  'internal'
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

const PEER_STATUSES = [
  'joined',
  'left',
  'disconnected',
  'reconnected',
  'finished',
  'dnf'
] as const

const CHAT_KINDS = ['join', 'leave', 'settings_changed', 'host_changed'] as const
export type ChatKind = (typeof CHAT_KINDS)[number]

/** Integer Unix-epoch milliseconds (§1 "Timestamps and units"). */
const unixMs = v.pipe(v.number(), v.integer())

// ── Server → client frames (§4) ─────────────────────────────────────────────

const HelloOkSchema = v.object({
  type: v.literal('hello_ok'),
  playerId: v.string(),
  serverVersion: v.number(),
  resumeToken: v.string()
})
export type HelloOkFrame = v.InferOutput<typeof HelloOkSchema>

const ErrorFrameSchema = v.object({
  type: v.literal('error'),
  code: v.picklist(ERROR_CODES),
  message: v.string()
})
export type ErrorFrame = v.InferOutput<typeof ErrorFrameSchema>

const NtpPongSchema = v.object({
  type: v.literal('ntp_pong'),
  t0: unixMs,
  t1: unixMs,
  t2: unixMs
})
export type NtpPongFrame = v.InferOutput<typeof NtpPongSchema>

const RoomStateSchema = v.object({
  type: v.literal('room_state'),
  code: v.string(),
  name: v.string(),
  visibility: v.picklist(['open', 'private']),
  hostPlayerId: v.string(),
  settings: RoomSettingsSchema,
  players: v.array(RoomPlayerSchema),
  /**
   * Present ONLY while a match is running (absent in the lobby). It exists for
   * exactly one case: a RELOADED client resumes its seat and gets a fresh
   * room_state, but it never saw that match's `countdown` — without this
   * descriptor the page cannot even tell that its seat is mid-match, so it
   * would sit in the lobby while everyone else waits for the deadline.
   */
  match: v.optional(v.object({ matchId: v.string(), goAtServerMs: unixMs }))
})
export type RoomStateFrame = v.InferOutput<typeof RoomStateSchema>

const CountdownSchema = v.object({
  type: v.literal('countdown'),
  matchId: v.string(),
  goAtServerMs: unixMs,
  /** Server-generated 32-bit seed, integer in [0, 2³²−1] (§4). */
  seed: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4294967295)),
  settings: RoomSettingsSchema,
  players: v.array(v.object({ playerId: v.string(), freemods: FreemodsSchema }))
})
export type CountdownFrame = v.InferOutput<typeof CountdownSchema>

const ChatFrameSchema = v.object({
  type: v.literal('chat'),
  /** Sender `playerId`, or `"system"` for server system messages. */
  from: v.string(),
  text: v.string(),
  ts: unixMs,
  /** Present only on system messages. */
  kind: v.optional(v.picklist(CHAT_KINDS))
})
export type ChatFrame = v.InferOutput<typeof ChatFrameSchema>

const KickedSchema = v.object({ type: v.literal('kicked') })
export type KickedFrame = v.InferOutput<typeof KickedSchema>

/**
 * The relayed `events` stay opaque at this layer; the transport additionally
 * runs them through `parseEventBatch` (shared/core) before any consumer sees
 * them — foreign bytes never reach a core unparsed.
 */
const PeerBatchSchema = v.object({
  type: v.literal('peer_batch'),
  playerId: v.string(),
  /**
   * The SENDER's event-log version (the relayed batch inherits it, §5): the
   * grammar `parseEventBatch` must parse `events` under. Optional with a v1
   * default for lenience toward older relays; the server always sends it.
   */
  version: v.optional(v.pipe(v.number(), v.integer()), 1),
  events: v.array(v.unknown())
})

const PeerStatusSchema = v.object({
  type: v.literal('peer_status'),
  playerId: v.string(),
  status: v.picklist(PEER_STATUSES)
})
export type PeerStatusFrame = v.InferOutput<typeof PeerStatusSchema>

/** Δ3: why the server ended the match (§4 `match_end`). */
const MATCH_END_REASONS = ['all_finished', 'deadline', 'finish_window'] as const
export type MatchEndReason = (typeof MATCH_END_REASONS)[number]

/**
 * One frozen-roster seat in `match_end.results` (§4). `finishedAtMs` is the
 * server clock at `finish` receipt — present ONLY for status `finished`.
 * `batchCount`/`eventCount` are accepted-envelope tallies (0 for a silent
 * player). The server still never parses the opaque events: `afkMs`/`afkShare`
 * are measured from batch ARRIVAL times (one-second receive buckets over the
 * seat's match window), not from anything inside them.
 */
const MatchEndResultSchema = v.object({
  playerId: v.string(),
  status: v.picklist(['finished', 'dnf', 'left']),
  finishedAtMs: v.optional(unixMs),
  batchCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  eventCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  /** Idle milliseconds inside this seat's match window (arrival-derived). */
  afkMs: v.optional(v.number()),
  /** `afkMs / windowMs`, 0..1 — the share the AFK kick rule evaluates. */
  afkShare: v.optional(v.number())
})
export type MatchEndResult = v.InferOutput<typeof MatchEndResultSchema>

/**
 * Δ3: broadcast exactly once per match to every seat (graced seats via their
 * backlog). `results` covers the FULL frozen roster (`countdown.players`),
 * in any order. This is the ONLY match-end signal — clients infer nothing.
 */
const MatchEndSchema = v.object({
  type: v.literal('match_end'),
  matchId: v.string(),
  reason: v.picklist(MATCH_END_REASONS),
  results: v.array(MatchEndResultSchema)
})
export type MatchEndFrame = v.InferOutput<typeof MatchEndSchema>

const ServerFrameSchema = v.variant('type', [
  HelloOkSchema,
  ErrorFrameSchema,
  NtpPongSchema,
  RoomStateSchema,
  CountdownSchema,
  ChatFrameSchema,
  KickedSchema,
  PeerBatchSchema,
  PeerStatusSchema,
  MatchEndSchema
])
export type ServerFrame = v.InferOutput<typeof ServerFrameSchema>

// ── Client → server frames (§3) ─────────────────────────────────────────────

const HelloSchema = v.object({
  type: v.literal('hello'),
  protocolVersion: v.number(),
  resumeToken: v.optional(v.string())
})
export type HelloFrame = v.InferOutput<typeof HelloSchema>

const NtpPingSchema = v.object({ type: v.literal('ntp_ping'), t0: unixMs })

const CreateRoomSchema = v.object({ type: v.literal('create_room') })

const JoinRoomSchema = v.object({ type: v.literal('join_room'), code: v.string() })

/** Δ1: optional `ready` flag, default true — `{type:'ready',ready:false}` un-readies. */
const ReadySchema = v.object({ type: v.literal('ready'), ready: v.optional(v.boolean()) })

const SettingsUpdateSchema = v.object({
  type: v.literal('settings_update'),
  settings: RoomSettingsSchema
})

const SetFreemodsSchema = v.object({
  type: v.literal('set_freemods'),
  freemods: FreemodsSchema
})

// `force` waives ONLY the readiness gate server-side; the two-seat floor holds.
const StartMatchSchema = v.object({ type: v.literal('start_match'), force: v.optional(v.boolean()) })

const KickSchema = v.object({ type: v.literal('kick'), playerId: v.string() })

const TransferHostSchema = v.object({
  type: v.literal('transfer_host'),
  playerId: v.string()
})

const ChatSendSchema = v.object({ type: v.literal('chat_send'), text: v.string() })

const EventBatchSchema = v.object({
  type: v.literal('event_batch'),
  matchId: v.string(),
  playerId: v.string(),
  /** Monotonic per-player counter starting at 1; server requires strictly lastSeq + 1. */
  batchSeq: v.pipe(v.number(), v.integer(), v.minValue(1)),
  /** Event-log format version (log-v1 ⇒ 1) — NOT the protocol version (§7.4). */
  version: v.pipe(v.number(), v.integer()),
  events: v.pipe(v.array(v.unknown()), v.minLength(1))
})
export type EventBatchFrame = v.InferOutput<typeof EventBatchSchema>

const LeaveSchema = v.object({ type: v.literal('leave') })

/**
 * §3 `finish` — the sender's run is over. `forfeit` says it ended with NO result
 * (a page reload abandoning a run it can no longer produce): the server records
 * that seat `dnf` instead of `finished` and it opens no finish window.
 */
const FinishSchema = v.object({
  type: v.literal('finish'),
  matchId: v.string(),
  forfeit: v.optional(v.boolean())
})

export const ClientFrameSchema = v.variant('type', [
  HelloSchema,
  NtpPingSchema,
  CreateRoomSchema,
  JoinRoomSchema,
  ReadySchema,
  SettingsUpdateSchema,
  SetFreemodsSchema,
  StartMatchSchema,
  KickSchema,
  TransferHostSchema,
  ChatSendSchema,
  EventBatchSchema,
  LeaveSchema,
  FinishSchema
])
export type ClientFrame = v.InferOutput<typeof ClientFrameSchema>

/** Everything `MatchTransport.send` accepts — `hello` is transport-internal. */
export type ClientCommand = Exclude<ClientFrame, HelloFrame>

// ── Boundary decoding ───────────────────────────────────────────────────────

export interface FrameDecodeError {
  readonly reason: 'bad-json' | 'bad-frame'
  /** The frame's `type` discriminator when one could be read. */
  readonly frameType?: string
  readonly message: string
  readonly raw: string
}

const describeIssues = (issues: readonly v.BaseIssue<unknown>[]): string =>
  issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path?.map((p) => String(p.key)).join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')

const frameTypeOf = (value: unknown): string | undefined => {
  if (typeof value === 'object' && value !== null && 'type' in value) {
    const type = value.type
    if (typeof type === 'string') return type
  }
  return undefined
}

/**
 * Decode one raw inbound text frame into a validated `ServerFrame`.
 * JSON and schema failures are reported with details — never adapted.
 */
export function decodeServerFrame(raw: string): Result<ServerFrame, FrameDecodeError> {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (cause) {
    return err({ reason: 'bad-json', message: `frame is not valid JSON: ${String(cause)}`, raw })
  }
  const parsed = v.safeParse(ServerFrameSchema, value)
  if (!parsed.success) {
    return err({
      reason: 'bad-frame',
      frameType: frameTypeOf(value),
      message: describeIssues(parsed.issues),
      raw
    })
  }
  return ok(parsed.output)
}
