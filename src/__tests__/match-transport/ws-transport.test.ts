// WsTransport behavior at the connection boundary: disconnect/resume with
// backlog replay (§6), terminal version_mismatch (§1), exponential backoff,
// and valibot/core rejection of malformed inbound frames.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EVENT_LOG_VERSION, insertEvent } from '@typemore/core'
import {
  type TransportEvent,
  type WebSocketLike,
  LoopbackServer,
  LoopbackTransport,
  PROTOCOL_VERSION,
  WsTransport
} from '@shared/match-transport'

/** Deterministic microtask-generation flush — loopback delivery uses no timers. */
const settle = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve()
}

const ofType = <T extends TransportEvent['type']>(events: TransportEvent[], type: T) =>
  events.filter((event): event is Extract<TransportEvent, { type: T }> => event.type === type)

interface Client {
  t: LoopbackTransport
  events: TransportEvent[]
}

async function connectClient(server: LoopbackServer): Promise<Client> {
  const t = new LoopbackTransport(server)
  const events: TransportEvent[] = []
  t.onEvent((event) => events.push(event))
  await t.connect()
  return { t, events }
}

/** Host + guest seated and racing; returns the frozen matchId. */
async function startedMatch(
  server: LoopbackServer
): Promise<{ host: Client; guest: Client; matchId: string }> {
  const host = await connectClient(server)
  host.t.send({ type: 'create_room' })
  await settle()
  const code = ofType(host.events, 'room_state').at(-1)!.code
  const guest = await connectClient(server)
  guest.t.send({ type: 'join_room', code })
  await settle()
  guest.t.send({ type: 'ready' })
  await settle()
  host.t.send({ type: 'start_match' })
  await settle()
  return { host, guest, matchId: ofType(host.events, 'countdown').at(-1)!.matchId }
}

const batch = (matchId: string, playerId: string, batchSeq: number, seq: number) =>
  ({
    type: 'event_batch',
    matchId,
    playerId,
    batchSeq,
    version: EVENT_LOG_VERSION,
    events: [insertEvent(seq, seq * 10, 'x')]
  }) as const

/** Hand-driven socket: the test plays the server side of the wire. */
class ManualSocket implements WebSocketLike {
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: (() => void) | null = null
  readonly sent: string[] = []

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = 3
  }

  open(): void {
    this.readyState = 1
    this.onopen?.()
  }

  push(frame: unknown): void {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) })
  }

  drop(): void {
    this.readyState = 3
    this.onclose?.({ code: 1006, reason: '' })
  }
}

describe('disconnect / resume (§6)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reclaims the seat with the resume token and replays the backlog in order', async () => {
    const server = new LoopbackServer()
    const { host, guest, matchId } = await startedMatch(server)
    const guestId = guest.t.playerId!

    guest.t.send(batch(matchId, guestId, 1, 1))
    await settle()
    expect(ofType(host.events, 'peer_batch')).toHaveLength(1)

    server.dropClient(guestId)
    await settle()
    expect(guest.t.state).toBe('reconnecting')
    expect(ofType(guest.events, 'reconnecting')).toHaveLength(1)
    expect(ofType(host.events, 'peer_status').at(-1)).toMatchObject({
      playerId: guestId,
      status: 'disconnected'
    })

    // Relay traffic while the guest is down lands in its server-side backlog.
    host.t.send(batch(matchId, host.t.playerId!, 1, 1))
    host.t.send(batch(matchId, host.t.playerId!, 2, 2))
    await settle()

    // Backoff timer (≤10 ms base) fires, re-hello presents the resume token.
    await vi.advanceTimersByTimeAsync(50)
    await settle()

    expect(guest.t.state).toBe('in_match') // room phase restored, not reset to idle
    expect(guest.t.playerId).toBe(guestId) // same seat — the token was honored
    const resumedIndex = guest.events.findIndex((event) => event.type === 'resumed')
    expect(resumedIndex).toBeGreaterThan(-1)
    const replayed = ofType(guest.events, 'peer_batch')
    expect(replayed.map((frame) => frame.events[0].seq)).toEqual([1, 2]) // backlog order preserved
    expect(guest.events.indexOf(replayed[0])).toBeGreaterThan(resumedIndex)
    expect(ofType(host.events, 'peer_status').at(-1)).toMatchObject({
      playerId: guestId,
      status: 'reconnected'
    })

    // batchSeq continues at lastSeq + 1 across the reconnect — no gap, no reset.
    guest.t.send(batch(matchId, guestId, 2, 2))
    await settle()
    expect(ofType(host.events, 'peer_batch')).toHaveLength(2)
    expect(ofType(guest.events, 'error')).toHaveLength(0)
  })

  it('grace expiry broadcasts dnf, frees the seat, and the match can still end', async () => {
    const server = new LoopbackServer()
    const { host, guest, matchId } = await startedMatch(server)
    const guestId = guest.t.playerId!

    server.dropClient(guestId)
    guest.t.disconnect() // give up instead of reconnecting
    await settle()

    await vi.advanceTimersByTimeAsync(15_001) // default 15 s grace window
    await settle()
    expect(ofType(host.events, 'peer_status').at(-1)).toMatchObject({
      playerId: guestId,
      status: 'dnf'
    })
    expect(ofType(host.events, 'room_state').at(-1)!.players).toHaveLength(1)

    host.t.send({ type: 'finish', matchId })
    await settle()
    expect(host.t.state).toBe('in_room') // dnf + finished ⇒ match over (§6)
  })
})

describe('version_mismatch (§1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is terminal: failed state, typed event, and zero reconnect attempts', async () => {
    const server = new LoopbackServer({ protocolVersion: 2 })
    const t = new LoopbackTransport(server)
    const events: TransportEvent[] = []
    t.onEvent((event) => events.push(event))

    await expect(t.connect()).rejects.toThrow(/version_mismatch/)
    expect(t.state).toBe('failed')
    expect(ofType(events, 'version-mismatch')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(60_000)
    await settle()
    expect(t.state).toBe('failed')
    expect(ofType(events, 'reconnecting')).toHaveLength(0)
  })
})

describe('reconnect backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('doubles the delay per attempt and gives up after maxAttempts', async () => {
    // Every socket dies before hello_ok; random() = 1 pins jitter to the cap.
    const factory = () => {
      const socket = new ManualSocket()
      queueMicrotask(() => socket.drop())
      return socket
    }
    const t = new WsTransport({
      url: 'ws://unreachable',
      webSocketFactory: factory,
      reconnect: { baseDelayMs: 100, maxDelayMs: 10_000, maxAttempts: 4 },
      random: () => 1
    })
    const events: TransportEvent[] = []
    t.onEvent((event) => events.push(event))

    const outcome = t.connect().catch((error: Error) => error.message)
    await settle()
    await vi.advanceTimersByTimeAsync(2_000)
    await settle()

    expect(ofType(events, 'reconnecting').map((event) => event.delayMs)).toEqual([
      100, 200, 400, 800
    ])
    expect(t.state).toBe('disconnected')
    expect(await outcome).toMatch(/exhausted/)
  })
})

describe('inbound boundary validation', () => {
  it('reports malformed frames as protocol-violation and keeps the connection usable', async () => {
    const socket = new ManualSocket()
    const t = new WsTransport({ url: 'ws://test', webSocketFactory: () => socket })
    const events: TransportEvent[] = []
    t.onEvent((event) => events.push(event))

    const connected = t.connect()
    socket.open()
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'hello', protocolVersion: PROTOCOL_VERSION })
    socket.push({
      type: 'hello_ok',
      playerId: 'p1',
      serverVersion: 1,
      resumeToken: 'ab'.repeat(32)
    })
    await connected

    socket.push('{ not json')
    socket.push({ type: 'mystery_frame', anything: true })
    socket.push({ type: 'room_state', code: 42 }) // schema violation: code must be a string
    socket.push({
      type: 'peer_batch',
      playerId: 'p2',
      events: [{ kind: 'teleport', seq: 1, t: 0 }]
    })
    socket.push({ type: 'peer_status', playerId: 'p2', status: 'meditating' }) // unknown status
    socket.push({ type: 'match_end', matchId: 'm_1', reason: 'boredom', results: [] }) // unknown reason
    socket.push({
      type: 'match_end',
      matchId: 'm_1',
      reason: 'deadline',
      results: [{ playerId: 'p2' }]
    }) // result missing counts/status
    socket.push({ type: 'ntp_pong', t0: 1, t1: 2, t2: 3 }) // valid frame still flows afterwards

    const violations = ofType(events, 'protocol-violation').map((event) => event.violation)
    expect(violations.map((violation) => violation.reason)).toEqual([
      'bad-json',
      'bad-frame',
      'bad-frame',
      'bad-events',
      'bad-frame',
      'bad-frame',
      'bad-frame'
    ])
    expect(violations[5].frameType).toBe('match_end')
    expect(violations[6].frameType).toBe('match_end')
    expect(violations[1].frameType).toBe('mystery_frame')
    expect(violations[2].frameType).toBe('room_state')
    expect(violations[3].message).toContain('p2')
    expect(ofType(events, 'ntp_pong')).toHaveLength(1)
    expect(ofType(events, 'peer_batch')).toHaveLength(0) // bad events never reach consumers
    expect(t.state).toBe('idle')
  })
})

describe('match_end (Δ3)', () => {
  const settings = {
    name: 'Room',
    visibility: 'private',
    mode: 'time',
    durationMs: 30_000,
    lang: 'english',
    dictHash: 'be99aa1a',
    textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
    textSource: { kind: 'seeded' }
  }
  const mods = { difficulty: 'normal', minWpm: 0, nospace: false }
  const result = (playerId: string, status: string, extra: Record<string, unknown> = {}) => ({
    playerId,
    status,
    batchCount: 0,
    eventCount: 0,
    ...extra
  })

  it("in_match → in_room fires ONLY on the active countdown's match_end — never on peer_status accounting", async () => {
    const socket = new ManualSocket()
    const t = new WsTransport({ url: 'ws://test', webSocketFactory: () => socket })
    const events: TransportEvent[] = []
    t.onEvent((event) => events.push(event))

    const connected = t.connect()
    socket.open()
    socket.push({
      type: 'hello_ok',
      playerId: 'p1',
      serverVersion: 1,
      resumeToken: 'ab'.repeat(32)
    })
    await connected
    socket.push({
      type: 'countdown',
      matchId: 'm_1',
      goAtServerMs: 1,
      seed: 1,
      settings,
      players: [
        { playerId: 'p1', freemods: mods },
        { playerId: 'p2', freemods: mods }
      ]
    })
    expect(t.state).toBe('in_match')

    // The WHOLE roster goes terminal via peer_status — the Δ3 transport
    // no longer infers an end from it.
    socket.push({ type: 'peer_status', playerId: 'p2', status: 'finished' })
    socket.push({ type: 'peer_status', playerId: 'p1', status: 'finished' })
    expect(t.state).toBe('in_match')

    // A stale match_end (previous match's id) never demotes the phase…
    socket.push({ type: 'match_end', matchId: 'm_0', reason: 'all_finished', results: [] })
    expect(t.state).toBe('in_match')

    // …but the active match's end does, and the frame reaches consumers.
    socket.push({
      type: 'match_end',
      matchId: 'm_1',
      reason: 'deadline',
      results: [
        result('p1', 'finished', {
          finishedAtMs: 1_737_645_130_000,
          batchCount: 3,
          eventCount: 40
        }),
        result('p2', 'dnf')
      ]
    })
    expect(t.state).toBe('in_room')
    const ends = ofType(events, 'match_end')
    expect(ends).toHaveLength(2) // the stale frame was still emitted
    expect(ends[1].reason).toBe('deadline')
    expect(ends[1].results.map((entry) => entry.playerId)).toEqual(['p1', 'p2'])
  })
})

describe('hello rejection (§2)', () => {
  it('fails fast: connect() rejects, state failed, no reconnect loop', async () => {
    const socket = new ManualSocket()
    const t = new WsTransport({ url: 'ws://test', webSocketFactory: () => socket })
    const events: TransportEvent[] = []
    t.onEvent((event) => events.push(event))

    const connected = t.connect()
    socket.open()
    // The contract-conformant hello carries no nick (§3: optional and ignored).
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'hello', protocolVersion: PROTOCOL_VERSION })
    // Observed against a non-conformant server build: hello rejected outright.
    socket.push({ type: 'error', code: 'bad_message', message: 'nick must be 1-16 characters' })

    await expect(connected).rejects.toThrow('hello rejected: bad_message')
    expect(t.state).toBe('failed')
    expect(ofType(events, 'error')).toHaveLength(1)
    expect(ofType(events, 'reconnecting')).toHaveLength(0)
    expect(socket.readyState).toBe(3) // socket closed, no retry scheduled
  })
})
