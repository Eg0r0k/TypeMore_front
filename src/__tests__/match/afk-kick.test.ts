// The idle kick over the loopback wire (MATCH.md "AFK"): the client kick is a
// courtesy, the server sweep is the authority — so every client number must
// sit strictly inside its server counterpart, the kick must ride the ORDINARY
// forfeit path (finish{forfeit:true}, eliminated screen, dnf row), and a kick
// that lands while the transport is down must drain through the existing
// finish parking on resume.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Dictionary, type TimerCommand, type TimerTick, dictVersion } from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import {
  type RoomSettings,
  type TransportEvent,
  AFK_KICK_SHARE,
  AFK_WARMUP_MS,
  LoopbackServer,
  LoopbackTransport
} from '@shared/match-transport'
import {
  type MatchSessionOptions,
  type MatchSessionStore,
  AFK_KICK_SHARE_CLIENT,
  AFK_KICK_STREAK_MS,
  AFK_KICK_WARMUP_MS,
  useMatchSessionStore
} from '@entities/match'

/**
 * The server's match timings, read from the artifact the backend generates from
 * its own Go constants (`TypeMore_back/contract/match-timings.json`, produced by
 * `make contract` and documented in that repo's `contract/README.md`).
 *
 * Reading it is the point. Both halves of every AFK pair used to be literals —
 * the server's `AfkTrailingMs = 15_000` was asserted by no Go test at all, and
 * the frontend carried its own copy of the number in a test — so either side
 * could be retyped and both repos stayed green. The artifact is the one place
 * the numbers exist; a consumer that copies them back out has bought nothing.
 *
 * The path assumes the sibling checkout the backend's own tooling assumes
 * (`FRONTEND ?= ../TypeMore_front` in its Makefile). `TYPEMORE_BACKEND`
 * overrides it. A checkout without the server repo SKIPS the assertion out
 * loud rather than passing quietly.
 */
const CONTRACT_PATH = resolve(
  process.env.TYPEMORE_BACKEND ?? '../TypeMore_back',
  'contract/match-timings.json'
)

interface ServerMatchTimings {
  readonly afkTrailingMs: number
  readonly afkKickShare: number
  readonly afkWarmupMs: number
}

const serverTimings = (): ServerMatchTimings | null => {
  let raw: string
  try {
    raw = readFileSync(CONTRACT_PATH, 'utf8')
  } catch {
    return null
  }
  // A malformed or truncated artifact is a FAILURE, not a skip: the file was
  // found, so something produced it wrong, and silently passing would hide it.
  const parsed = JSON.parse(raw) as { match?: Partial<ServerMatchTimings> }
  const match = parsed.match
  if (
    typeof match?.afkTrailingMs !== 'number' ||
    typeof match.afkKickShare !== 'number' ||
    typeof match.afkWarmupMs !== 'number'
  ) {
    throw new Error(`${CONTRACT_PATH} does not carry the match AFK timings`)
  }
  return {
    afkTrailingMs: match.afkTrailingMs,
    afkKickShare: match.afkKickShare,
    afkWarmupMs: match.afkWarmupMs
  }
}

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  readonly sent: TimerCommand[] = []

  postMessage(message: TimerCommand): void {
    this.sent.push(message)
  }

  terminate(): void {
    // nothing to release
  }
}

const dict: Dictionary = { name: 'test', bcp47: 'xx', words: ['ab', 'cd', 'ef', 'gh', 'ij', 'kl'] }
const loadDictionary = async (): Promise<Dictionary> => dict

const settings: RoomSettings = {
  name: 'Test room',
  visibility: 'private',
  mode: 'words',
  wordCount: 3,
  lang: 'xx',
  dictHash: dictVersion(dict.words),
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'seeded' }
}

/** Real-timer polling — same rationale as session-resilience: one consistent clock. */
async function until(cond: () => boolean, label: string, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now()
  while (!cond()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`timed out waiting for ${label}`)
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 5)
    await promise
  }
}

interface RawClient {
  transport: LoopbackTransport
  events: TransportEvent[]
}

async function joinRaw(server: LoopbackServer, code: string): Promise<RawClient> {
  const transport = new LoopbackTransport(server)
  const events: TransportEvent[] = []
  transport.onEvent((event) => events.push(event))
  await transport.connect()
  transport.send({ type: 'join_room', code })
  await until(() => transport.state === 'in_room', 'raw client seated')
  return { transport, events }
}

const matchIdOf = (events: TransportEvent[]): string => {
  const countdown = events.find((event) => event.type === 'countdown')
  if (countdown === undefined || countdown.type !== 'countdown')
    throw new Error('no countdown observed')
  return countdown.matchId
}

/** Room of self + one raw spectator, started; the raw seat finishes on demand. */
async function startMatch(
  server: LoopbackServer,
  afkKick: MatchSessionOptions['afkKick'],
  reconnect?: { baseDelayMs: number; maxDelayMs: number }
): Promise<{ session: MatchSessionStore; transport: LoopbackTransport; raw: RawClient }> {
  const transport = new LoopbackTransport(server, reconnect ? { reconnect } : undefined)
  const session = useMatchSessionStore()
  await session.init(transport, {
    loadDictionary,
    createTimerWorker: () => new FakeTimerWorker(),
    ghostDelayMs: 50,
    afkKick
  })
  session.createRoom()
  await until(() => session.room !== null, 'room created')
  session.updateSettings(settings)
  const raw = await joinRaw(server, session.room!.code)
  raw.transport.send({ type: 'ready' })
  await until(
    () =>
      session.room?.players.length === 2 &&
      session.room.players.every((p) => p.ready || p.playerId === session.selfId),
    'seats ready'
  )
  session.startMatch()
  await until(() => session.phase === 'running', 'go')
  return { session, transport, raw }
}

describe('idle kick (loopback)', () => {
  let cleanups: Array<() => void> = []

  beforeEach(() => {
    setActivePinia(createPinia())
    cleanups = []
  })

  afterEach(() => {
    for (const cleanup of cleanups) cleanup()
  })

  it('every client number sits strictly inside its server counterpart', () => {
    const server = serverTimings()
    if (server === null) {
      // Stated, not silent: a checkout without the sibling server repo cannot
      // run this assertion, and a green run that skipped it must say so.
      console.warn(`skipping the server-threshold check: ${CONTRACT_PATH} is not readable`)
      return
    }

    // Every number comes from the backend's own generated artifact
    // (TypeMore_back/contract/match-timings.json, `make contract`) — nothing
    // here is a literal. A retyped constant on the server therefore fails HERE,
    // which is the whole reason the artifact exists: before it, the frontend
    // carried its own copy of 15 000 and the two could drift in silence.
    expect(AFK_KICK_SHARE_CLIENT).toBeLessThan(server.afkKickShare)
    expect(AFK_KICK_WARMUP_MS).toBeLessThan(server.afkWarmupMs)
    // The streak is checked against the server's TRAILING rule (MATCH.md "AFK"
    // documents them as a pair); the loopback does not mirror that rule at all.
    expect(AFK_KICK_STREAK_MS).toBeLessThan(server.afkTrailingMs)

    // The loopback is the client's stand-in for the sweep, so its own mirror of
    // the two server numbers has to BE the server's, not merely be above the
    // client's. A drifted mirror would make every kick test below a test of a
    // server that does not exist.
    expect(AFK_KICK_SHARE).toBe(server.afkKickShare)
    expect(AFK_WARMUP_MS).toBe(server.afkWarmupMs)
  })

  it('a seat that never types is kicked by its own rule onto the eliminated screen', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session, raw } = await startMatch(server, { streakMs: 500 })
    cleanups.push(() => session.dispose())
    cleanups.push(() => raw.transport.disconnect())

    // Never type. The streak runs from GO, so the seat measures itself out.
    await until(() => session.phase === 'eliminated', 'idle kick')
    expect(session.afkProgress).toBe(1)
    expect(session.selfOutcome?.reason).toBe('idle')

    // The ordinary forfeit path on the wire: once the raw seat finishes, the
    // match ends and the kicked seat is a dnf row — no new wire entity.
    raw.transport.send({ type: 'finish', matchId: matchIdOf(raw.events) })
    await until(() => session.phase === 'results', 'match end')
    const selfRow = session.standings!.find((row) => row.isSelf)!
    expect(selfRow.status).toBe('dnf')
  })

  it('typing resets the streak; silence after typing still kicks', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session, raw } = await startMatch(server, { streakMs: 900 })
    cleanups.push(() => session.dispose())
    cleanups.push(() => raw.transport.disconnect())

    // Keep touching the run well inside the streak window: no kick.
    for (let burst = 0; burst < 3; burst++) {
      session.selfView.insert('a')
      session.selfView.deleteBackward()
      const { promise, resolve } = Promise.withResolvers<void>()
      setTimeout(resolve, 300)
      await promise
      expect(session.phase).toBe('running')
    }
    // The meter reset with the last burst — nowhere near the kick.
    expect(session.afkProgress).toBeLessThan(0.7)

    // Now go silent: the kick lands with real numbers behind it.
    await until(() => session.phase === 'eliminated', 'kick after silence')
    expect(session.selfOutcome?.reason).toBe('idle')
  })

  it('client leaves by its own share rule before the server sweep would take it', async () => {
    // Scaled share pair, same margins as production: client 0.55/1200ms inside
    // the server's 0.6/1600ms. The streak is parked out of the way so only the
    // share mirror can fire — the rule a streak alone cannot dominate.
    const server = new LoopbackServer({ countdownLeadMs: 40, afkWarmupMs: 1600 })
    const { session, raw } = await startMatch(server, {
      streakMs: 60_000,
      shareThreshold: 0.55,
      warmupMs: 1200
    })
    cleanups.push(() => session.dispose())
    cleanups.push(() => raw.transport.disconnect())

    await until(() => session.phase === 'eliminated', 'share-mirror kick')
    // Kicked by the CLIENT rule — the server sweep marks a swept seat dnf on
    // the wire without any local afk verdict, so `reason: 'idle'` is the
    // proof the client got there first.
    expect(session.selfOutcome?.reason).toBe('idle')

    raw.transport.send({ type: 'finish', matchId: matchIdOf(raw.events) })
    await until(() => session.phase === 'results', 'match end')
    expect(session.standings!.find((row) => row.isSelf)!.status).toBe('dnf')
  })

  it('a kick during reconnecting parks the finish and drains it on resume', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    // A 1.5 s reconnect backoff makes the outage deterministic: one drop and
    // the transport stays down long past the 400 ms streak.
    const { session, transport, raw } = await startMatch(
      server,
      { streakMs: 400 },
      { baseDelayMs: 1500, maxDelayMs: 1500 }
    )
    cleanups.push(() => session.dispose())
    cleanups.push(() => raw.transport.disconnect())

    server.dropClient(transport.playerId!)
    await until(() => session.connection === 'reconnecting', 'transport down')

    await until(() => session.phase === 'eliminated', 'kick while down')
    // The seam under test: the finish frame could not leave — it is parked.
    expect(session.connection).toBe('reconnecting')

    // Resume drains the parked finish (hello_ok → pendingFinish → send); the
    // raw seat finishes and the match completes with the kicked seat as dnf.
    await until(
      () => session.connection === 'in_match' || session.connection === 'in_room',
      'resumed',
      20_000
    )
    raw.transport.send({ type: 'finish', matchId: matchIdOf(raw.events) })
    await until(() => session.phase === 'results', 'match end across the outage', 20_000)
    expect(session.standings!.find((row) => row.isSelf)!.status).toBe('dnf')
    expect(session.selfOutcome?.reason).toBe('idle')
  })
})
