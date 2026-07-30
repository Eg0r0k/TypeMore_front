import type { EventLogVersion, GameEvent } from '@typemore/core'
import { EVENT_LOG_VERSION } from '@typemore/core'
import type { EventBatchFrame } from './protocol'
import type { MatchTransport, Unsubscribe } from './transport'
import { CONNECTED_STATES } from './transport'

/** Client batching contract, PROTOCOL.md §3 `event_batch`. */
export const BATCH_FLUSH_INTERVAL_MS = 100
export const BATCH_MAX_EVENTS = 16

export interface EventBatcherOptions {
  readonly transport: MatchTransport
  /** Default {@link BATCH_FLUSH_INTERVAL_MS}. */
  readonly flushIntervalMs?: number
  /** Default {@link BATCH_MAX_EVENTS}. */
  readonly maxEvents?: number
}

/**
 * Buffers outgoing `GameEvent`s and flushes them as `event_batch` frames:
 * every ≤ `flushIntervalMs` OR every `maxEvents` events, whichever comes
 * first (§3). Never sends an empty batch.
 *
 * `batchSeq` is monotonic from 1 per match (`startMatch` resets it) — the
 * server requires strictly `lastSeq + 1`. While the transport is disconnected
 * or reconnecting, flushed batches are parked in an outbox and re-sent, in
 * order, after `hello_ok` — no loss, no seq gaps across a reconnect.
 */
export class EventBatcher {
  private readonly transport: MatchTransport
  private readonly flushIntervalMs: number
  private readonly maxEvents: number
  private readonly unsubscribe: Unsubscribe

  private matchId: string | null = null
  private version: EventLogVersion = EVENT_LOG_VERSION
  private seq = 0
  private buffer: GameEvent[] = []
  private outbox: EventBatchFrame[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(options: EventBatcherOptions) {
    this.transport = options.transport
    this.flushIntervalMs = options.flushIntervalMs ?? BATCH_FLUSH_INTERVAL_MS
    this.maxEvents = options.maxEvents ?? BATCH_MAX_EVENTS
    // Re-handshake completed ⇒ the seat is restored; drain parked batches in order.
    this.unsubscribe = options.transport.onEvent((event) => {
      if (event.type === 'hello_ok') this.drainOutbox()
    })
  }

  /** Events buffered toward the next batch. */
  get pendingEvents(): number {
    return this.buffer.length
  }

  /** Batches parked while the transport was down. */
  get queuedBatches(): number {
    return this.outbox.length
  }

  /**
   * Arm a new match: `batchSeq` restarts at 1, buffers are cleared. `version`
   * is THIS RUN's event-log version (the store's per-run capability decision):
   * a v2 run's batches carry telemetry events and say so on the frame — the
   * `event_batch.version` field exists for exactly this.
   */
  startMatch(matchId: string, version: EventLogVersion = EVENT_LOG_VERSION): void {
    this.clearTimer()
    this.matchId = matchId
    this.version = version
    this.seq = 0
    this.buffer = []
    this.outbox = []
  }

  push(event: GameEvent): void {
    if (this.matchId === null) throw new Error('EventBatcher.push() without an active match')
    this.buffer.push(event)
    if (this.buffer.length >= this.maxEvents) {
      this.flush()
      return
    }
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.flush()
      }, this.flushIntervalMs)
    }
  }

  /** Flush the current buffer immediately (no-op when empty — empty batches never go out). */
  flush(): void {
    this.clearTimer()
    if (this.buffer.length === 0 || this.matchId === null) return
    const playerId = this.transport.playerId
    if (playerId === null)
      throw new Error('EventBatcher.flush() before hello_ok assigned a playerId')
    const frame: EventBatchFrame = {
      type: 'event_batch',
      matchId: this.matchId,
      playerId,
      batchSeq: ++this.seq,
      version: this.version,
      events: this.buffer
    }
    this.buffer = []
    // Outbox-first keeps batches strictly seq-ordered across a reconnect.
    if (this.outbox.length > 0 || !CONNECTED_STATES.includes(this.transport.state)) {
      this.outbox.push(frame)
      return
    }
    this.sendOrPark(frame)
  }

  /** Flush the tail and disarm. Parked batches stay queued for the next `hello_ok`. */
  endMatch(): void {
    this.flush()
    this.matchId = null
  }

  dispose(): void {
    this.clearTimer()
    this.unsubscribe()
  }

  private drainOutbox(): void {
    while (this.outbox.length > 0 && CONNECTED_STATES.includes(this.transport.state)) {
      const frame = this.outbox[0]
      try {
        this.transport.send(frame)
      } catch {
        return // transport dropped again mid-drain; frame stays parked
      }
      this.outbox.shift()
    }
  }

  private sendOrPark(frame: EventBatchFrame): void {
    try {
      this.transport.send(frame)
    } catch {
      this.outbox.push(frame) // lost the race with a drop: park, never lose the batch
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
