import type { GameEvent } from '@typemore/core'
import type {
  ChatFrame,
  ClientCommand,
  CountdownFrame,
  ErrorFrame,
  HelloOkFrame,
  KickedFrame,
  MatchEndFrame,
  NtpPongFrame,
  PeerStatusFrame,
  RoomStateFrame
} from './protocol'

/**
 * `MatchTransport` — the DI seam for the network phase (docs/game-architecture.md).
 * The match store takes a transport by injection, mirroring how the timer worker
 * is injected — no global singletons. `WsTransport` is the production
 * implementation, `LoopbackTransport` the in-memory one for tests/dev.
 */

export const TRANSPORT_STATES = [
  /** No socket; initial state, after `disconnect()`, or after retries were exhausted. */
  'disconnected',
  /** Socket opening / `hello` sent, awaiting `hello_ok`. */
  'connecting',
  /** Unintentional drop; backoff timer armed, will re-`hello` with the resume token. */
  'reconnecting',
  /** `hello_ok` received, not seated in any room. */
  'idle',
  /** Seated in a room (first `room_state` received). */
  'in_room',
  /** `countdown` received; match running. */
  'in_match',
  /** Terminal: `version_mismatch`. No reconnect is ever attempted. */
  'failed'
] as const
export type TransportState = (typeof TRANSPORT_STATES)[number]

/** States in which the socket is open and `hello_ok` has been received. */
export const CONNECTED_STATES: readonly TransportState[] = ['idle', 'in_room', 'in_match']

export interface ProtocolViolation {
  /** Where validation failed: JSON decode, frame schema, or `peer_batch.events` core parse. */
  readonly reason: 'bad-json' | 'bad-frame' | 'bad-events'
  /** The frame's `type` discriminator when one could be read. */
  readonly frameType?: string
  readonly message: string
  /** The offending raw payload, for reporting. */
  readonly raw?: unknown
}

/**
 * A relayed peer batch whose opaque `events` have passed `parseEventBatch`
 * (shared/core). This replaces the raw wire frame on the event stream —
 * consumers never see unparsed foreign events.
 */
export interface PeerBatchEvent {
  readonly type: 'peer_batch'
  readonly playerId: string
  readonly events: readonly GameEvent[]
}

/** Emitted on every state transition (also mirrored via `onState`). */
export interface ConnectionEvent {
  readonly type: 'connection'
  readonly state: TransportState
  readonly prev: TransportState
}

export interface ReconnectingEvent {
  readonly type: 'reconnecting'
  readonly attempt: number
  readonly delayMs: number
}

/** `hello_ok` received on a connection that presented a resume token. */
export interface ResumedEvent {
  readonly type: 'resumed'
}

/** Terminal: server rejected our protocol version. No retry will happen. */
export interface VersionMismatchEvent {
  readonly type: 'version-mismatch'
  readonly message: string
}

export interface ProtocolViolationEvent {
  readonly type: 'protocol-violation'
  readonly violation: ProtocolViolation
}

/**
 * Everything a transport can emit. Server frames are passed through as
 * validated wire shapes, except `peer_batch` (core-parsed, see
 * {@link PeerBatchEvent}) and `error{code:'version_mismatch'}` (surfaced as
 * {@link VersionMismatchEvent} instead of an `error` frame).
 */
export type TransportEvent =
  | HelloOkFrame
  | ErrorFrame
  | NtpPongFrame
  | RoomStateFrame
  | CountdownFrame
  | ChatFrame
  | KickedFrame
  | PeerStatusFrame
  | MatchEndFrame
  | PeerBatchEvent
  | ConnectionEvent
  | ReconnectingEvent
  | ResumedEvent
  | VersionMismatchEvent
  | ProtocolViolationEvent

export interface ConnectOptions {
  /** Present a resume token from a previous `hello_ok` to reclaim a seat (§6). */
  readonly resumeToken?: string
}

export type Unsubscribe = () => void

export interface MatchTransport {
  /** Current state; plain subscription via `onState` (Pinia wrapping is the store's job). */
  readonly state: TransportState
  /** Server-issued identity from `hello_ok`; null before the first handshake. */
  readonly playerId: string | null
  /** Latest resume token from `hello_ok`; presented automatically on reconnect. */
  readonly resumeToken: string | null
  /** Open the connection and handshake. Resolves on `hello_ok`, rejects on terminal failure. */
  connect(options?: ConnectOptions): Promise<void>
  /** Intentional close: no reconnect, session identity cleared. */
  disconnect(): void
  /** Send one client→server frame (`hello` is transport-internal and excluded). */
  send(frame: ClientCommand): void
  /** Subscribe to the typed inbound event stream. Returns an unsubscribe. */
  onEvent(listener: (event: TransportEvent) => void): Unsubscribe
  /** Subscribe to state transitions. Returns an unsubscribe. */
  onState(listener: (state: TransportState, prev: TransportState) => void): Unsubscribe
}
