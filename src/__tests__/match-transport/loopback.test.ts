// Loopback round-trips: the full production client path (WsTransport) against
// the in-memory server — create/join/ready/start/relay/finish per PROTOCOL.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EVENT_LOG_VERSION, insertEvent } from '@typemore/core'
import {
  type MatchTransport,
  type RoomSettings,
  type RoomStateFrame,
  type TransportEvent,
  LoopbackServer,
  LoopbackTransport
} from '@shared/match-transport'

/**
 * Flushes the delivery cascade. Zero-latency loopback delivery is
 * microtask-chained (no timers), so yielding a bounded number of microtask
 * generations is fully deterministic — no wall-clock waiting.
 */
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

const lastRoom = (client: Client): RoomStateFrame | undefined =>
  ofType(client.events, 'room_state').at(-1)

async function createRoom(server: LoopbackServer): Promise<{ host: Client; code: string }> {
  const host = await connectClient(server)
  host.t.send({ type: 'create_room' })
  await settle()
  const room = lastRoom(host)
  if (room === undefined) throw new Error('no room_state after create_room')
  return { host, code: room.code }
}

async function joinRoom(server: LoopbackServer, code: string): Promise<Client> {
  const guest = await connectClient(server)
  guest.t.send({ type: 'join_room', code })
  await settle()
  return guest
}

const wordsSettings: RoomSettings = {
  name: 'Words room',
  visibility: 'private',
  mode: 'words',
  wordCount: 3,
  lang: 'english',
  dictHash: 'be99aa1a',
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'seeded' }
}

/** Host + ready guest in one room; `settings` applied before the guest readies. */
async function seatedPair(
  server: LoopbackServer,
  settings?: RoomSettings
): Promise<{ host: Client; guest: Client }> {
  const { host, code } = await createRoom(server)
  if (settings !== undefined) {
    host.t.send({ type: 'settings_update', settings })
    await settle()
  }
  const guest = await joinRoom(server, code)
  guest.t.send({ type: 'ready' })
  await settle()
  return { host, guest }
}

async function startMatch(host: Client, guest: Client): Promise<string> {
  host.t.send({ type: 'start_match' })
  await settle()
  const countdown = ofType(guest.events, 'countdown').at(-1)
  if (countdown === undefined) throw new Error('no countdown after start_match')
  return countdown.matchId
}

/** One accepted `event_batch` — the AFK rule only cares that it ARRIVED. */
function sendBatch(client: Client, matchId: string, batchSeq: number): void {
  client.t.send({
    type: 'event_batch',
    matchId,
    playerId: client.t.playerId!,
    batchSeq,
    version: EVENT_LOG_VERSION,
    events: [insertEvent(batchSeq, 0, 'a')]
  })
}

describe('loopback rooms', () => {
  it('runs the full create/join/ready/start/relay/finish round-trip', async () => {
    const server = new LoopbackServer()
    const { host, code } = await createRoom(server)
    expect(host.t.state).toBe('in_room')
    expect(lastRoom(host)?.players).toHaveLength(1)
    expect(lastRoom(host)?.hostPlayerId).toBe(host.t.playerId)

    // Join is case-insensitive (§5).
    const guest = await joinRoom(server, code.toLowerCase())
    expect(guest.t.state).toBe('in_room')
    expect(lastRoom(host)?.players).toHaveLength(2)
    expect(ofType(host.events, 'chat').some((c) => c.from === 'system' && c.kind === 'join')).toBe(
      true
    )

    // Ready gating: start before the guest is ready ⇒ not_ready.
    host.t.send({ type: 'start_match' })
    await settle()
    expect(ofType(host.events, 'error').at(-1)?.code).toBe('not_ready')
    expect(ofType(guest.events, 'countdown')).toHaveLength(0)

    guest.t.send({ type: 'ready' })
    await settle()
    expect(lastRoom(host)?.players.find((p) => p.playerId === guest.t.playerId)?.ready).toBe(true)

    host.t.send({ type: 'start_match' })
    await settle()
    const cd = ofType(host.events, 'countdown').at(-1)
    const cdGuest = ofType(guest.events, 'countdown').at(-1)
    expect(cd).toBeDefined()
    expect(cdGuest).toEqual(cd) // frozen snapshot is identical for every seat
    expect(Number.isInteger(cd?.seed)).toBe(true)
    expect(cd!.seed).toBeGreaterThanOrEqual(0)
    expect(cd!.seed).toBeLessThanOrEqual(2 ** 32 - 1)
    expect(host.t.state).toBe('in_match')
    expect(guest.t.state).toBe('in_match')

    // Relay: opaque events reach the peer parsed, in order; never echo to the sender.
    host.t.send({
      type: 'event_batch',
      matchId: cd!.matchId,
      playerId: host.t.playerId!,
      batchSeq: 1,
      version: EVENT_LOG_VERSION,
      events: [insertEvent(1, 0, 'a'), insertEvent(2, 8, 'b')]
    })
    await settle()
    const relayed = ofType(guest.events, 'peer_batch')
    expect(relayed).toHaveLength(1)
    expect(relayed[0].playerId).toBe(host.t.playerId)
    expect(relayed[0].events.map((e) => e.seq)).toEqual([1, 2])
    expect(ofType(host.events, 'peer_batch')).toHaveLength(0)

    // Finish: match ends only when every participant is done (§6).
    host.t.send({ type: 'finish', matchId: cd!.matchId })
    await settle()
    expect(ofType(guest.events, 'peer_status').at(-1)).toMatchObject({
      playerId: host.t.playerId,
      status: 'finished'
    })
    expect(host.t.state).toBe('in_match')
    guest.t.send({ type: 'finish', matchId: cd!.matchId })
    await settle()
    expect(host.t.state).toBe('in_room')
    expect(guest.t.state).toBe('in_room')
    // Match end resets every ready flag (§6).
    expect(lastRoom(guest)?.players.every((p) => !p.ready)).toBe(true)
  })

  it('rejects a 6th seat with room_full and an unknown code with room_not_found', async () => {
    const server = new LoopbackServer()
    const { code } = await createRoom(server)
    for (let i = 0; i < 4; i++) await joinRoom(server, code)
    const sixth = await joinRoom(server, code)
    expect(ofType(sixth.events, 'error').at(-1)?.code).toBe('room_full')
    expect(sixth.t.state).toBe('idle')

    const lost = await connectClient(server)
    lost.t.send({ type: 'join_room', code: 'ZZZZZZ' })
    await settle()
    expect(ofType(lost.events, 'error').at(-1)?.code).toBe('room_not_found')
  })

  it('kick drops the target with a neutral leave; the target can rejoin', async () => {
    const server = new LoopbackServer()
    const { host, code } = await createRoom(server)
    const guest = await joinRoom(server, code)

    host.t.send({ type: 'kick', playerId: guest.t.playerId! })
    await settle()
    expect(ofType(guest.events, 'kicked')).toHaveLength(1)
    expect(guest.t.state).toBe('idle')
    expect(lastRoom(host)?.players).toHaveLength(1)
    // A kick is indistinguishable from a voluntary leave on the wire (§3).
    expect(ofType(host.events, 'chat').at(-1)?.kind).toBe('leave')

    guest.t.send({ type: 'join_room', code })
    await settle()
    expect(guest.t.state).toBe('in_room')

    // Non-host kick attempts are forbidden.
    guest.t.send({ type: 'kick', playerId: host.t.playerId! })
    await settle()
    expect(ofType(guest.events, 'error').at(-1)?.code).toBe('forbidden')
  })

  it('transfers the host role explicitly and auto-succeeds to the earliest-joined seat', async () => {
    const server = new LoopbackServer()
    const { host, code } = await createRoom(server)
    const g1 = await joinRoom(server, code)
    const g2 = await joinRoom(server, code)

    host.t.send({ type: 'transfer_host', playerId: g1.t.playerId! })
    await settle()
    expect(lastRoom(g2)?.hostPlayerId).toBe(g1.t.playerId)
    expect(ofType(g2.events, 'chat').some((c) => c.kind === 'host_changed')).toBe(true)

    g1.t.send({ type: 'leave' })
    await settle()
    expect(g1.t.state).toBe('idle')
    // Earliest-joined remaining seat (the original host) succeeds automatically (§5).
    expect(lastRoom(g2)?.hostPlayerId).toBe(host.t.playerId)
    expect(lastRoom(g2)?.players).toHaveLength(2)
  })

  it('broadcasts chat to every seat and rate-limits a burst beyond 5', async () => {
    const server = new LoopbackServer()
    const { host, code } = await createRoom(server)
    const guest = await joinRoom(server, code)

    for (let i = 0; i < 6; i++) host.t.send({ type: 'chat_send', text: `msg ${i}` })
    await settle()
    const received = ofType(guest.events, 'chat').filter((c) => c.from === host.t.playerId)
    expect(received.map((c) => c.text)).toEqual(['msg 0', 'msg 1', 'msg 2', 'msg 3', 'msg 4'])
    expect(ofType(host.events, 'error').at(-1)?.code).toBe('rate_limited')

    // Empty-after-trim is bad_message.
    guest.t.send({ type: 'chat_send', text: '   ' })
    await settle()
    expect(ofType(guest.events, 'error').at(-1)?.code).toBe('bad_message')
  })

  it('fans a batch out to every other seat in a 5-player room, in per-player order', async () => {
    const server = new LoopbackServer()
    const { host, code } = await createRoom(server)
    const guests: Client[] = []
    for (let i = 0; i < 4; i++) guests.push(await joinRoom(server, code))
    for (const guest of guests) guest.t.send({ type: 'ready' })
    await settle()
    host.t.send({ type: 'start_match' })
    await settle()
    const matchId = ofType(host.events, 'countdown').at(-1)!.matchId
    const all: MatchTransport[] = [host.t, ...guests.map((g) => g.t)]
    expect(all.every((t) => t.state === 'in_match')).toBe(true)

    const sender = guests[1]
    sender.t.send({
      type: 'event_batch',
      matchId,
      playerId: sender.t.playerId!,
      batchSeq: 1,
      version: EVENT_LOG_VERSION,
      events: [insertEvent(1, 0, 'x')]
    })
    sender.t.send({
      type: 'event_batch',
      matchId,
      playerId: sender.t.playerId!,
      batchSeq: 2,
      version: EVENT_LOG_VERSION,
      events: [insertEvent(2, 10, 'y')]
    })
    await settle()

    for (const receiver of [host, guests[0], guests[2], guests[3]]) {
      const batches = ofType(receiver.events, 'peer_batch').filter(
        (b) => b.playerId === sender.t.playerId
      )
      expect(batches.map((b) => b.events[0].seq)).toEqual([1, 2])
    }
    expect(ofType(sender.events, 'peer_batch')).toHaveLength(0)
  })

  it('rejects a batchSeq gap with bad_message and relays nothing', async () => {
    const server = new LoopbackServer()
    const { host, code } = await createRoom(server)
    const guest = await joinRoom(server, code)
    guest.t.send({ type: 'ready' })
    await settle()
    host.t.send({ type: 'start_match' })
    await settle()
    const matchId = ofType(host.events, 'countdown').at(-1)!.matchId

    host.t.send({
      type: 'event_batch',
      matchId,
      playerId: host.t.playerId!,
      batchSeq: 2, // server requires strictly lastSeq + 1 = 1
      version: EVENT_LOG_VERSION,
      events: [insertEvent(1, 0, 'a')]
    })
    await settle()
    expect(ofType(host.events, 'error').at(-1)?.code).toBe('bad_message')
    expect(ofType(guest.events, 'peer_batch')).toHaveLength(0)
  })
})

describe('Δ3 match_end + words AFK rules', () => {
  it('words match ending all_finished: exactly-once per seat, roster tallies, ordering', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 0 })
    const { host, guest } = await seatedPair(server, wordsSettings)
    const matchId = await startMatch(host, guest)

    host.t.send({
      type: 'event_batch',
      matchId,
      playerId: host.t.playerId!,
      batchSeq: 1,
      version: EVENT_LOG_VERSION,
      events: [insertEvent(1, 0, 'a'), insertEvent(2, 8, 'b')]
    })
    host.t.send({ type: 'finish', matchId })
    await settle()
    expect(ofType(host.events, 'match_end')).toHaveLength(0) // guest still racing

    guest.t.send({ type: 'finish', matchId })
    await settle()

    for (const client of [host, guest]) {
      const ends = ofType(client.events, 'match_end')
      expect(ends).toHaveLength(1) // exactly once per seat
      const end = ends[0]
      expect(end.matchId).toBe(matchId)
      expect(end.reason).toBe('all_finished')
      expect([...end.results.map((entry) => entry.playerId)].sort()).toEqual(
        [host.t.playerId!, guest.t.playerId!].sort()
      )
      const hostRow = end.results.find((entry) => entry.playerId === host.t.playerId)!
      const guestRow = end.results.find((entry) => entry.playerId === guest.t.playerId)!
      expect(hostRow).toMatchObject({ status: 'finished', batchCount: 1, eventCount: 2 })
      expect(typeof hostRow.finishedAtMs).toBe('number')
      expect(guestRow).toMatchObject({ status: 'finished', batchCount: 0, eventCount: 0 })
      expect(guestRow.finishedAtMs!).toBeGreaterThanOrEqual(hostRow.finishedAtMs!)
      // §4 ordering: AFTER the final peer_status, BEFORE the post-match room_state.
      const endIndex = client.events.indexOf(end)
      const lastStatusIndex = client.events.reduce(
        (acc, event, index) => (event.type === 'peer_status' ? index : acc),
        -1
      )
      expect(lastStatusIndex).toBeLessThan(endIndex)
      const postRoomState = client.events.findIndex(
        (event, index) => index > endIndex && event.type === 'room_state'
      )
      expect(postRoomState).toBeGreaterThan(endIndex)
      expect(client.t.state).toBe('in_room')
    }
  })

  it('room_state carries the running match descriptor — and only while it runs', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 0 })
    const { host, guest } = await seatedPair(server, wordsSettings)
    expect(lastRoom(host)!.match).toBeUndefined() // lobby: no match to describe
    const matchId = await startMatch(host, guest)

    // Any mid-match room_state carries it — that snapshot is the ONLY way a
    // reloaded page (which never saw the countdown) learns its seat is racing.
    host.t.send({ type: 'ready', ready: false })
    await settle()
    expect(lastRoom(host)!.match).toEqual({ matchId, goAtServerMs: expect.any(Number) })

    host.t.send({ type: 'finish', matchId })
    guest.t.send({ type: 'finish', matchId })
    await settle()
    expect(lastRoom(host)!.match).toBeUndefined() // the post-match room_state drops it
  })

  describe('timed rules', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('the AFK share rule dnfs a silent words seat; a typing seat is untouched', async () => {
      // Warm-up 2 s ⇒ the rule first bites on the 2nd elapsed one-second bucket.
      const server = new LoopbackServer({ countdownLeadMs: 0, afkWarmupMs: 2000 })
      const { host, guest } = await seatedPair(server, wordsSettings)
      const matchId = await startMatch(host, guest)

      // One host batch per bucket: buckets 0 and 1 are ACTIVE for the host and
      // idle for the silent guest.
      await vi.advanceTimersByTimeAsync(100)
      sendBatch(host, matchId, 1)
      await settle()
      await vi.advanceTimersByTimeAsync(1000) // t=1100; the t=1000 sweep is still inside warm-up
      sendBatch(host, matchId, 2)
      await settle()
      expect(
        ofType(host.events, 'peer_status').filter((frame) => frame.status === 'dnf')
      ).toHaveLength(0)

      // t=2000: two elapsed buckets, the guest idled both ⇒ share 1.0 ≥ 0.6.
      await vi.advanceTimersByTimeAsync(1000)
      expect(ofType(host.events, 'peer_status').at(-1)).toMatchObject({
        playerId: guest.t.playerId,
        status: 'dnf'
      })
      expect(ofType(host.events, 'match_end')).toHaveLength(0) // host still racing

      host.t.send({ type: 'finish', matchId })
      await settle()
      const end = ofType(host.events, 'match_end')[0]
      expect(end.reason).toBe('all_finished')
      const guestRow = end.results.find((entry) => entry.playerId === guest.t.playerId)!
      expect(guestRow).toMatchObject({
        status: 'dnf',
        batchCount: 0,
        eventCount: 0,
        afkMs: 2000,
        afkShare: 1
      })
      expect(guestRow.finishedAtMs).toBeUndefined()
      // The typing seat's window holds no idle bucket at all.
      expect(end.results.find((entry) => entry.playerId === host.t.playerId)).toMatchObject({
        status: 'finished',
        afkMs: 0,
        afkShare: 0
      })
      expect(host.t.state).toBe('in_room')
      expect(guest.t.state).toBe('in_room') // the dnf'd seat still got match_end
    })

    it('the FIRST words finish opens the window; close dnfs stragglers, reason finish_window', async () => {
      const server = new LoopbackServer({ countdownLeadMs: 0, finishWindowMs: 80 })
      const { host, guest } = await seatedPair(server, wordsSettings)
      const matchId = await startMatch(host, guest)

      host.t.send({ type: 'finish', matchId }) // t≈0: window armed, closes at 80
      await settle()

      // t=40: the guest is active (idle rule satisfied) but slow.
      await vi.advanceTimersByTimeAsync(40)
      guest.t.send({
        type: 'event_batch',
        matchId,
        playerId: guest.t.playerId!,
        batchSeq: 1,
        version: EVENT_LOG_VERSION,
        events: [insertEvent(1, 0, 'a')]
      })
      await settle()

      await vi.advanceTimersByTimeAsync(50) // t=90 > 80: window closed
      expect(ofType(host.events, 'peer_status').at(-1)).toMatchObject({
        playerId: guest.t.playerId,
        status: 'dnf'
      })
      for (const client of [host, guest]) {
        const end = ofType(client.events, 'match_end')[0]
        expect(end.reason).toBe('finish_window')
        expect(end.results.find((entry) => entry.playerId === guest.t.playerId)).toMatchObject({
          status: 'dnf',
          batchCount: 1,
          eventCount: 1
        })
        expect(client.t.state).toBe('in_room')
      }
    })

    it('a graced seat gets match_end via its backlog — the resumer lands in_room', async () => {
      const server = new LoopbackServer({ countdownLeadMs: 0, afkWarmupMs: 1000 })
      const { host, code } = await createRoom(server)
      host.t.send({ type: 'settings_update', settings: wordsSettings })
      await settle()
      // Slow reconnect policy keeps the guest offline past the AFK dnf + match end.
      const guest: Client = {
        t: new LoopbackTransport(server, { reconnect: { baseDelayMs: 3000, maxDelayMs: 3000 } }),
        events: []
      }
      guest.t.onEvent((event) => guest.events.push(event))
      await guest.t.connect()
      guest.t.send({ type: 'join_room', code })
      await settle()
      guest.t.send({ type: 'ready' })
      await settle()
      const matchId = await startMatch(host, guest)

      server.dropClient(guest.t.playerId!)
      await settle()
      host.t.send({ type: 'finish', matchId })
      await settle()
      expect(ofType(host.events, 'match_end')).toHaveLength(0) // graced seat still racing

      // t=1000: the graced seat is NOT exempt from the AFK rule ⇒ dnf ⇒ match ends.
      await vi.advanceTimersByTimeAsync(1100)
      expect(ofType(host.events, 'match_end')).toHaveLength(1)
      expect(host.t.state).toBe('in_room')
      expect(ofType(guest.events, 'match_end')).toHaveLength(0) // still offline

      // Resume within grace: the backlog replays match_end exactly once.
      await vi.advanceTimersByTimeAsync(3000)
      await settle()
      expect(ofType(guest.events, 'resumed')).toHaveLength(1)
      const ends = ofType(guest.events, 'match_end')
      expect(ends).toHaveLength(1)
      expect(ends[0].reason).toBe('all_finished')
      expect(ends[0].results.find((entry) => entry.playerId === guest.t.playerId)?.status).toBe(
        'dnf'
      )
      expect(guest.t.state).toBe('in_room')
    })

    it('time mode is never swept — its duration+slack deadline is server-side, not the AFK rule', async () => {
      const server = new LoopbackServer({ countdownLeadMs: 0, afkWarmupMs: 50 })
      const { host, guest } = await seatedPair(server) // default settings: time mode
      await startMatch(host, guest)

      await vi.advanceTimersByTimeAsync(10_000)
      await settle()
      expect(
        ofType(host.events, 'peer_status').filter((frame) => frame.status === 'dnf')
      ).toHaveLength(0)
      expect(
        ofType(guest.events, 'peer_status').filter((frame) => frame.status === 'dnf')
      ).toHaveLength(0)
      expect(host.t.state).toBe('in_match')
      expect(guest.t.state).toBe('in_match')
    })
  })
})
