// Batching contract (PROTOCOL.md §3): ≤100 ms OR 16 events, whichever first;
// batchSeq monotonic from 1 per match; no empty batches; no loss or seq gaps
// across a disconnect/reconnect.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { insertEvent } from '@typemore/core'
import {
  type ClientCommand,
  type ConnectOptions,
  type EventBatchFrame,
  type MatchTransport,
  type TransportEvent,
  type TransportState,
  type Unsubscribe,
  BATCH_FLUSH_INTERVAL_MS,
  BATCH_MAX_EVENTS,
  EventBatcher
} from '@shared/match-transport'

/** Synchronous transport double: enough surface for the batcher's contract. */
class FakeTransport implements MatchTransport {
  state: TransportState = 'in_match'
  playerId: string | null = 'p_self'
  resumeToken: string | null = null
  readonly sent: EventBatchFrame[] = []
  private readonly listeners = new Set<(event: TransportEvent) => void>()

  connect(_options?: ConnectOptions): Promise<void> {
    return Promise.resolve()
  }

  disconnect(): void {}

  send(frame: ClientCommand): void {
    if (this.state !== 'idle' && this.state !== 'in_room' && this.state !== 'in_match') {
      throw new Error(`cannot send while ${this.state}`)
    }
    if (frame.type === 'event_batch') this.sent.push(frame)
  }

  onEvent(listener: (event: TransportEvent) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onState(): Unsubscribe {
    return () => {}
  }

  emitHelloOk(): void {
    const frame: TransportEvent = {
      type: 'hello_ok',
      playerId: 'p_self',
      serverVersion: 1,
      resumeToken: 'a'.repeat(64)
    }
    for (const listener of [...this.listeners]) listener(frame)
  }
}

describe('EventBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = () => {
    const transport = new FakeTransport()
    const batcher = new EventBatcher({ transport })
    batcher.startMatch('m_1')
    return { transport, batcher }
  }

  it('flushes on the 100 ms timer with a fully stamped envelope', () => {
    const { transport, batcher } = setup()
    batcher.push(insertEvent(1, 0, 'a'))
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS - 1)
    expect(transport.sent).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]).toMatchObject({
      type: 'event_batch',
      matchId: 'm_1',
      playerId: 'p_self',
      batchSeq: 1,
      version: 1
    })
    expect(transport.sent[0].events).toHaveLength(1)
  })

  it('flushes immediately at 16 events, and the drained timer does not double-fire', () => {
    const { transport, batcher } = setup()
    for (let i = 1; i <= BATCH_MAX_EVENTS; i++) batcher.push(insertEvent(i, i, 'x'))
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0].events).toHaveLength(BATCH_MAX_EVENTS)
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS * 2)
    expect(transport.sent).toHaveLength(1) // no empty follow-up batch
  })

  it('never sends an empty batch', () => {
    const { transport, batcher } = setup()
    batcher.flush()
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS * 3)
    expect(transport.sent).toHaveLength(0)
  })

  it('keeps batchSeq monotonic across timer and size flushes', () => {
    const { transport, batcher } = setup()
    batcher.push(insertEvent(1, 0, 'a'))
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS)
    for (let i = 2; i <= BATCH_MAX_EVENTS + 1; i++) batcher.push(insertEvent(i, i, 'x'))
    batcher.push(insertEvent(99, 990, 'z'))
    batcher.flush()
    expect(transport.sent.map((frame) => frame.batchSeq)).toEqual([1, 2, 3])
  })

  it('parks flushes while disconnected and drains them in order on hello_ok — no loss, no gaps', () => {
    const { transport, batcher } = setup()
    transport.state = 'reconnecting'

    batcher.push(insertEvent(1, 0, 'a'))
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS)
    batcher.push(insertEvent(2, 5, 'b'))
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS)
    expect(transport.sent).toHaveLength(0)
    expect(batcher.queuedBatches).toBe(2)

    transport.state = 'in_match' // hello_ok restored the seat
    transport.emitHelloOk()
    expect(batcher.queuedBatches).toBe(0)
    expect(transport.sent.map((frame) => frame.batchSeq)).toEqual([1, 2])
    expect(transport.sent.map((frame) => frame.events.length)).toEqual([1, 1])

    batcher.push(insertEvent(3, 10, 'c'))
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS)
    expect(transport.sent.map((frame) => frame.batchSeq)).toEqual([1, 2, 3]) // continuity after resume
  })

  it('a flush racing a drop parks the batch instead of losing it', () => {
    const { transport, batcher } = setup()
    batcher.push(insertEvent(1, 0, 'a'))
    // The transport still reports a connected state but the socket is already gone.
    transport.send = () => {
      throw new Error('socket closed')
    }
    vi.advanceTimersByTime(BATCH_FLUSH_INTERVAL_MS)
    expect(batcher.queuedBatches).toBe(1)
  })

  it('startMatch restarts batchSeq at 1 for the new matchId', () => {
    const { transport, batcher } = setup()
    batcher.push(insertEvent(1, 0, 'a'))
    batcher.flush()
    batcher.startMatch('m_2')
    batcher.push(insertEvent(1, 0, 'b'))
    batcher.flush()
    expect(transport.sent.map((frame) => [frame.matchId, frame.batchSeq])).toEqual([
      ['m_1', 1],
      ['m_2', 1]
    ])
  })

  it('endMatch flushes the tail and push outside a match throws', () => {
    const { transport, batcher } = setup()
    batcher.push(insertEvent(1, 0, 'a'))
    batcher.endMatch()
    expect(transport.sent).toHaveLength(1)
    expect(() => batcher.push(insertEvent(2, 1, 'b'))).toThrow()
  })
})
