import { parseEventBatch } from '@typemore/core'
import type { ClientCommand, HelloFrame, ServerFrame } from './protocol'
import { PROTOCOL_VERSION, decodeServerFrame } from './protocol'
import type {
  ConnectOptions,
  MatchTransport,
  TransportEvent,
  TransportState,
  Unsubscribe
} from './transport'
import { CONNECTED_STATES } from './transport'

/**
 * Minimal structural surface of a browser `WebSocket`, injectable for tests
 * and for `LoopbackTransport` (which connects the same client logic to an
 * in-memory server).
 */
export interface WebSocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: { code: number; reason: string }) => void) | null
  onerror: (() => void) | null
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface ReconnectPolicy {
  /** First retry delay; doubles each attempt. Default 500. */
  readonly baseDelayMs?: number
  /** Backoff ceiling. Default 15000. */
  readonly maxDelayMs?: number
  /** Give up after this many consecutive failed attempts. Default Infinity. */
  readonly maxAttempts?: number
}

export interface WsTransportOptions {
  readonly url: string
  /** Injectable socket constructor; defaults to the native `WebSocket`. */
  readonly webSocketFactory?: WebSocketFactory
  readonly reconnect?: ReconnectPolicy
  /** Jitter source in [0, 1). Default `Math.random`. */
  readonly random?: () => number
}

type RoomPhase = 'idle' | 'in_room' | 'in_match'

const defaultFactory: WebSocketFactory = (url) => {
  // DOM lib declares handler params (Event/MessageEvent) wider than WebSocketLike;
  // we only ever ASSIGN narrower handlers into them, so the shapes are compatible at runtime.
  const socket: WebSocketLike = new WebSocket(url) as unknown as WebSocketLike
  return socket
}

/**
 * Production `MatchTransport` over a native WebSocket (JSON text frames only,
 * PROTOCOL.md §1).
 *
 * - `connect()` opens the socket and sends `hello {protocolVersion: 1}` as the
 *   first frame (+ `resumeToken` when reconnecting); resolves on `hello_ok`.
 * - Unintentional drops reconnect with exponential backoff + jitter, presenting
 *   the stored resume token; `version_mismatch` is TERMINAL (state `failed`,
 *   no retry loop).
 * - EVERY inbound frame is valibot-parsed before any consumer sees it;
 *   `peer_batch.events` additionally pass `parseEventBatch` (shared/core).
 *   Malformed input becomes a `protocol-violation` event — reported, never
 *   silently dropped or adapted.
 */
export class WsTransport implements MatchTransport {
  private readonly url: string
  private readonly factory: WebSocketFactory
  private readonly baseDelayMs: number
  private readonly maxDelayMs: number
  private readonly maxAttempts: number
  private readonly random: () => number

  private socket: WebSocketLike | null = null
  private currentState: TransportState = 'disconnected'
  /** Room-level phase, preserved across reconnects so a resume restores it. */
  private roomPhase: RoomPhase = 'idle'
  private currentPlayerId: string | null = null
  private currentResumeToken: string | null = null
  /** Whether the in-flight `hello` presented a resume token. */
  private presentedResume = false
  private intentional = false
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pendingConnect: { resolve: () => void; reject: (error: Error) => void } | null = null
  /** matchId of the active countdown; gates the Δ3 `match_end` phase transition. */
  private activeMatchId: string | null = null

  private readonly eventListeners = new Set<(event: TransportEvent) => void>()
  private readonly stateListeners = new Set<(state: TransportState, prev: TransportState) => void>()

  constructor(options: WsTransportOptions) {
    this.url = options.url
    this.factory = options.webSocketFactory ?? defaultFactory
    this.baseDelayMs = options.reconnect?.baseDelayMs ?? 500
    this.maxDelayMs = options.reconnect?.maxDelayMs ?? 15_000
    this.maxAttempts = options.reconnect?.maxAttempts ?? Number.POSITIVE_INFINITY
    this.random = options.random ?? Math.random
  }

  get state(): TransportState {
    return this.currentState
  }

  get playerId(): string | null {
    return this.currentPlayerId
  }

  get resumeToken(): string | null {
    return this.currentResumeToken
  }

  connect(options?: ConnectOptions): Promise<void> {
    if (this.currentState !== 'disconnected' && this.currentState !== 'failed') {
      return Promise.reject(new Error(`connect() called while ${this.currentState}`))
    }
    if (options?.resumeToken !== undefined) this.currentResumeToken = options.resumeToken
    this.intentional = false
    this.attempt = 0
    return new Promise<void>((resolve, reject) => {
      this.pendingConnect = { resolve, reject }
      this.openSocket()
    })
  }

  disconnect(): void {
    this.intentional = true
    this.clearReconnectTimer()
    const socket = this.socket
    this.socket = null
    this.currentPlayerId = null
    this.currentResumeToken = null
    this.roomPhase = 'idle'
    this.activeMatchId = null
    this.rejectPendingConnect(new Error('disconnected before hello_ok'))
    this.setState('disconnected')
    socket?.close(1000, 'client disconnect')
  }

  send(frame: ClientCommand): void {
    if (this.socket === null || !CONNECTED_STATES.includes(this.currentState)) {
      throw new Error(`cannot send '${frame.type}' while ${this.currentState}`)
    }
    this.socket.send(JSON.stringify(frame))
    if (frame.type === 'leave') {
      // The server does not confirm a leave to the leaver (§7.6): transition now.
      this.roomPhase = 'idle'
      this.activeMatchId = null
      this.setState('idle')
    }
  }

  onEvent(listener: (event: TransportEvent) => void): Unsubscribe {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  onState(listener: (state: TransportState, prev: TransportState) => void): Unsubscribe {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private openSocket(): void {
    if (this.currentState !== 'reconnecting') this.setState('connecting')
    const socket = this.factory(this.url)
    this.socket = socket
    socket.onopen = () => this.sendHello()
    socket.onmessage = (event) => this.handleRaw(String(event.data))
    socket.onclose = () => this.handleClose(socket)
    socket.onerror = () => {
      // A close event follows every fatal error; reconnect is driven from there.
    }
  }

  private sendHello(): void {
    if (this.socket === null) return
    this.presentedResume = this.currentResumeToken !== null
    const hello: HelloFrame = this.presentedResume
      ? {
          type: 'hello',
          protocolVersion: PROTOCOL_VERSION,
          resumeToken: this.currentResumeToken ?? undefined
        }
      : { type: 'hello', protocolVersion: PROTOCOL_VERSION }
    this.socket.send(JSON.stringify(hello))
  }

  private handleRaw(raw: string): void {
    const decoded = decodeServerFrame(raw)
    if (decoded.isErr()) {
      const { reason, frameType, message } = decoded.error
      this.emit({ type: 'protocol-violation', violation: { reason, frameType, message, raw } })
      return
    }
    this.handleFrame(decoded.value)
  }

  private handleFrame(frame: ServerFrame): void {
    switch (frame.type) {
      case 'hello_ok': {
        // A resume the server did not honor (grace expired ⇒ fresh identity)
        // must not restore the room phase: compare identities.
        const resumed =
          this.presentedResume &&
          (this.currentPlayerId === null || this.currentPlayerId === frame.playerId)
        this.currentPlayerId = frame.playerId
        this.currentResumeToken = frame.resumeToken
        this.attempt = 0
        if (!resumed) {
          this.roomPhase = 'idle'
          this.activeMatchId = null
        }
        this.setState(this.roomPhase)
        this.emit(frame)
        if (resumed) this.emit({ type: 'resumed' })
        this.pendingConnect?.resolve()
        this.pendingConnect = null
        return
      }
      case 'error': {
        if (frame.code === 'version_mismatch') {
          // Terminal per §1/§4: the server closes after this frame; never retry.
          this.clearReconnectTimer()
          this.setState('failed')
          this.emit({ type: 'version-mismatch', message: frame.message })
          this.rejectPendingConnect(new Error(`version_mismatch: ${frame.message}`))
          this.socket?.close()
          return
        }
        if (this.currentState === 'connecting' || this.currentState === 'reconnecting') {
          // Before hello_ok nothing else is in flight (§2), so this error is a
          // hello rejection. Our hello is contract-conformant; an identical
          // retry cannot succeed — fail fast instead of hanging in connecting.
          // (Observed live: a server build rejecting the optional-and-ignored
          // `nick` — a PROTOCOL.md §3 violation on the server side.)
          this.clearReconnectTimer()
          this.setState('failed')
          this.emit(frame)
          this.rejectPendingConnect(new Error(`hello rejected: ${frame.code}: ${frame.message}`))
          this.socket?.close()
          return
        }
        this.emit(frame)
        return
      }
      case 'room_state': {
        if (this.roomPhase !== 'in_match') {
          // Mid-match room_state broadcasts (a seat left / was kicked) do not
          // demote the phase; match end arrives as `match_end` (Δ3) below.
          this.roomPhase = 'in_room'
          this.setState('in_room')
        }
        this.emit(frame)
        return
      }
      case 'countdown': {
        this.roomPhase = 'in_match'
        this.activeMatchId = frame.matchId
        this.setState('in_match')
        this.emit(frame)
        return
      }
      case 'kicked': {
        this.roomPhase = 'idle'
        this.activeMatchId = null
        this.setState('idle')
        this.emit(frame)
        return
      }
      case 'peer_batch': {
        // Parse under the SENDER's log version (the frame carries it for
        // exactly this): a v2 peer's batches interleave telemetry with the
        // state events, and the ghost core folds the telemetry as no-ops. An
        // unknown future version fails as bad-version → protocol-violation →
        // that one ghost freezes desynced; nobody else is affected.
        const parsed = parseEventBatch({ version: frame.version, events: frame.events })
        if (parsed.isErr()) {
          this.emit({
            type: 'protocol-violation',
            violation: {
              reason: 'bad-events',
              frameType: 'peer_batch',
              message: `peer_batch from ${frame.playerId}: ${parsed.error.message}`,
              raw: frame.events
            }
          })
          return
        }
        this.emit({ type: 'peer_batch', playerId: frame.playerId, events: parsed.value.events })
        return
      }
      case 'peer_status': {
        // Δ3: peer_status is presentation-only — match end is `match_end`.
        this.emit(frame)
        return
      }
      case 'match_end': {
        // §6: the ONLY in_match → in_room transition. A stale frame (previous
        // match's id) never demotes the phase but still reaches consumers.
        if (this.roomPhase === 'in_match' && frame.matchId === this.activeMatchId) {
          this.activeMatchId = null
          this.roomPhase = 'in_room'
          this.setState('in_room')
        }
        this.emit(frame)
        return
      }
      case 'ntp_pong':
      case 'chat': {
        this.emit(frame)
        return
      }
    }
  }

  private handleClose(socket: WebSocketLike): void {
    if (this.socket !== socket && this.socket !== null) return // stale socket
    this.socket = null
    if (this.intentional || this.currentState === 'failed' || this.currentState === 'disconnected')
      return
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    this.attempt += 1
    if (this.attempt > this.maxAttempts) {
      this.setState('disconnected')
      this.rejectPendingConnect(new Error('reconnect attempts exhausted'))
      return
    }
    const cap = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (this.attempt - 1))
    // Jitter: uniform in [cap/2, cap) so herds decorrelate but delay stays bounded.
    const delayMs = Math.round(cap / 2 + this.random() * (cap / 2))
    this.setState('reconnecting')
    this.emit({ type: 'reconnecting', attempt: this.attempt, delayMs })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delayMs)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private rejectPendingConnect(error: Error): void {
    this.pendingConnect?.reject(error)
    this.pendingConnect = null
  }

  private setState(next: TransportState): void {
    if (next === this.currentState) return
    const prev = this.currentState
    this.currentState = next
    for (const listener of [...this.stateListeners]) listener(next, prev)
    this.emit({ type: 'connection', state: next, prev })
  }

  private emit(event: TransportEvent): void {
    for (const listener of [...this.eventListeners]) listener(event)
  }
}
