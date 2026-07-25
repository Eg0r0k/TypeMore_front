// Δ1 (ready toggle) + Δ2 (universal resume): lobby-phase disconnects keep the
// seat for the grace window and a hello{resumeToken} reclaims it in any phase;
// `ready:false` un-readies a seat. Mirrors the Go server's semantics.
import { describe, expect, it, vi } from 'vitest'

import {
  type RoomStateFrame,
  type TransportEvent,
  LoopbackServer,
  LoopbackTransport
} from '@shared/match-transport'

/** Zero-latency loopback delivery is microtask-chained — settle deterministically. */
const settle = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve()
}

const ofType = <T extends TransportEvent['type']>(events: TransportEvent[], type: T) =>
  events.filter((event): event is Extract<TransportEvent, { type: T }> => event.type === type)

interface Client {
  t: LoopbackTransport
  events: TransportEvent[]
}

async function connectClient(server: LoopbackServer, resumeToken?: string): Promise<Client> {
  const t = new LoopbackTransport(server)
  const events: TransportEvent[] = []
  t.onEvent((event) => events.push(event))
  await t.connect(resumeToken === undefined ? undefined : { resumeToken })
  return { t, events }
}

const lastRoom = (client: Client): RoomStateFrame | undefined =>
  ofType(client.events, 'room_state').at(-1)

async function seatedPair(
  server: LoopbackServer
): Promise<{ host: Client; guest: Client; code: string }> {
  const host = await connectClient(server)
  host.t.send({ type: 'create_room' })
  await settle()
  const code = lastRoom(host)!.code
  const guest = await connectClient(server)
  guest.t.send({ type: 'join_room', code })
  await settle()
  return { host, guest, code }
}

describe('ready toggle (Δ1)', () => {
  it('ready:false clears the flag; bare ready still sets it', async () => {
    const server = new LoopbackServer()
    const { host, guest } = await seatedPair(server)

    guest.t.send({ type: 'ready' })
    await settle()
    expect(lastRoom(host)!.players.find((p) => p.playerId === guest.t.playerId)?.ready).toBe(true)

    guest.t.send({ type: 'ready', ready: false })
    await settle()
    expect(lastRoom(host)!.players.find((p) => p.playerId === guest.t.playerId)?.ready).toBe(false)

    // Un-readied seat gates start_match again.
    host.t.send({ type: 'start_match' })
    await settle()
    expect(ofType(host.events, 'error').at(-1)?.code).toBe('not_ready')
  })
})

describe('lobby resume (Δ2)', () => {
  it('a dropped lobby seat is reclaimed by resumeToken: same identity, room_state replayed, no leave chat', async () => {
    const server = new LoopbackServer()
    const { host, guest, code } = await seatedPair(server)
    const hostId = host.t.playerId!
    const token = host.t.resumeToken!
    const chatsBefore = ofType(guest.events, 'chat').length

    host.t.disconnect() // page reload: the socket dies without a leave frame
    await settle()

    // The seat survives the drop: no leave chat, still 2 seats for the guest.
    expect(ofType(guest.events, 'chat').length).toBe(chatsBefore)
    expect(lastRoom(guest)!.players).toHaveLength(2)

    const revived = await connectClient(server, token)
    await settle()
    expect(revived.t.playerId).toBe(hostId)
    expect(revived.t.state).toBe('in_room')
    const snapshot = lastRoom(revived)
    expect(snapshot?.code).toBe(code)
    expect(snapshot?.players).toHaveLength(2)
    expect(snapshot?.hostPlayerId).toBe(hostId) // the host kept its role across the reload
    expect(ofType(guest.events, 'chat').length).toBe(chatsBefore) // still silent on the wire
  })

  it('grace expiry outside a match runs the normal leave flow', async () => {
    const server = new LoopbackServer()
    const { host, guest } = await seatedPair(server)
    const hostId = host.t.playerId!

    // Only the grace timer is clock-driven (delivery is microtask-chained), so
    // fake timers advance it deterministically.
    vi.useFakeTimers()
    try {
      host.t.disconnect()
      await vi.advanceTimersByTimeAsync(15_000 + 50)
    } finally {
      vi.useRealTimers()
    }
    await settle()

    const snapshot = lastRoom(guest)!
    expect(snapshot.players).toHaveLength(1)
    expect(snapshot.hostPlayerId).toBe(guest.t.playerId) // succession after expiry
    expect(
      ofType(guest.events, 'chat').some((c) => c.from === 'system' && c.kind === 'leave')
    ).toBe(true)
    expect(snapshot.players.some((p) => p.playerId === hostId)).toBe(false)
  })

  it('a solo host room survives a reload-length drop', async () => {
    const server = new LoopbackServer()
    const host = await connectClient(server)
    host.t.send({ type: 'create_room' })
    await settle()
    const code = lastRoom(host)!.code
    const token = host.t.resumeToken!

    host.t.disconnect()
    await settle()
    expect(server.roomCount).toBe(1) // graced seat keeps the room alive

    const revived = await connectClient(server, token)
    await settle()
    expect(lastRoom(revived)?.code).toBe(code)
    expect(revived.t.state).toBe('in_room')
  })
})
