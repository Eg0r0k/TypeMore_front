// Session resilience over the loopback wire: per-peer seq-gap freeze
// (desynced), duplicate idempotency, and mid-match drop + resume continuity
// (own batchSeq unbroken, inbound backlog applied exactly once).
import { createPinia, setActivePinia } from 'pinia'
import { until } from '../helpers/until'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type Dictionary,
  type GameEvent,
  type TimerCommand,
  type TimerTick,
  EVENT_LOG_VERSION,
  commitEvent,
  dictVersion,
  insertEvent
} from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import {
  type RoomSettings,
  type TransportEvent,
  LoopbackServer,
  LoopbackTransport
} from '@shared/match-transport'
import {
  type MatchSessionStore,
  type PeerView,
  addLoopbackBot,
  useMatchSessionStore
} from '@entities/match'

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

/**
 * Real-timer polling — deliberate: integration tests of a timing protocol
 * (batch cadence, reconnect backoff, go scheduling) where Date.now,
 * performance.now and setTimeout must stay mutually consistent; fake timers
 * split those clocks and desync the match anchor.
 */
interface RawClient {
  transport: LoopbackTransport
  events: TransportEvent[]
  /** Send one event_batch envelope with the client's own running batchSeq. */
  sendBatch(matchId: string, events: GameEvent[]): void
}

async function joinRaw(server: LoopbackServer, code: string): Promise<RawClient> {
  const transport = new LoopbackTransport(server)
  const events: TransportEvent[] = []
  transport.onEvent((event) => events.push(event))
  await transport.connect()
  transport.send({ type: 'join_room', code })
  await until(() => transport.state === 'in_room', 'raw client seated')
  let batchSeq = 0
  return {
    transport,
    events,
    sendBatch: (matchId, batch) => {
      batchSeq += 1
      transport.send({
        type: 'event_batch',
        matchId,
        playerId: transport.playerId!,
        batchSeq,
        version: EVENT_LOG_VERSION,
        events: batch
      })
    }
  }
}

interface Harness {
  session: MatchSessionStore
  transport: LoopbackTransport
}

async function createSession(server: LoopbackServer): Promise<Harness> {
  const transport = new LoopbackTransport(server)
  const session = useMatchSessionStore()
  await session.init(transport, {
    loadDictionary,
    createTimerWorker: () => new FakeTimerWorker(),
    ghostDelayMs: 50
  })
  return { session, transport }
}

function typeOwnRun(session: MatchSessionStore): void {
  for (const word of session.selfView.words) {
    for (const char of word) session.selfView.insert(char)
    session.selfView.commit()
  }
}

const matchIdOf = (events: TransportEvent[]): string => {
  const countdown = events.find((event) => event.type === 'countdown')
  if (countdown === undefined || countdown.type !== 'countdown')
    throw new Error('no countdown observed')
  return countdown.matchId
}

describe('match session resilience (loopback)', () => {
  let cleanups: Array<() => void> = []

  beforeEach(() => {
    setActivePinia(createPinia())
    cleanups = []
  })

  afterEach(() => {
    for (const cleanup of cleanups) cleanup()
  })

  it('freezes a peer with a seq gap as desynced; other peers progress untouched', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room created')
    session.updateSettings(settings)
    const gappy = await joinRaw(server, session.room!.code)
    cleanups.push(() => gappy.transport.disconnect())
    await addLoopbackBot(server, session.room!.code, { wpm: 500, loadDictionary })
    gappy.transport.send({ type: 'ready' })
    await until(
      () =>
        session.room?.players.every((p) => p.ready || p.playerId === session.selfId) === true &&
        session.room?.players.length === 3,
      'seats ready'
    )
    session.startMatch()
    await until(() => session.phase === 'running', 'go')
    const matchId = matchIdOf(gappy.events)

    // seq 1,2 then a GAP (3,4 dropped server-side in the slow-consumer story).
    gappy.sendBatch(matchId, [insertEvent(1, 0, 'a'), insertEvent(2, 10, 'b')])
    gappy.sendBatch(matchId, [insertEvent(5, 40, 'x'), insertEvent(6, 50, 'y')])

    const gappyPeer = (): PeerView =>
      session.peers.find((peer) => peer.playerId === gappy.transport.playerId)!
    await until(() => gappyPeer().status === 'desynced', 'gap freeze')
    // Nothing past the gap is ever dispatched: word 0 keeps only seq 1-2 input.
    await until(() => gappyPeer().view.snapshot.input[0] === 'ab', 'pre-gap events displayed')
    expect(gappyPeer().view.wordIndex).toBe(0)

    // Others are unaffected: the bot races to the finish, the session completes.
    gappy.transport.send({ type: 'finish', matchId })
    typeOwnRun(session)
    await until(() => session.phase === 'results', 'match end despite the frozen peer')
    expect(session.standings).toHaveLength(3)
    // Δ3 fallback ordering: the desynced peer's truncated log cannot prove a
    // words completion — finishTimeMs stays undefined, and the standings fall
    // back to match_end.finishedAtMs, ranking it below every log-proven finisher.
    const gappyRow = session.standings!.find((row) => row.playerId === gappy.transport.playerId)!
    expect(gappyRow.status).toBe('finished')
    expect(gappyRow.finishTimeMs).toBeUndefined()
    expect(gappyRow.rank).toBe(3)
    // Its post-gap display state never moved even though the server said finished.
    expect(gappyPeer().view.wordIndex).toBe(0)
    const botPeer = session.peers.find((peer) => peer.playerId !== gappy.transport.playerId)!
    expect(botPeer.status).toBe('finished')
    expect(botPeer.view.finished).toBe(true)
  })

  it('ignores duplicated events idempotently (reconnect-backlog overlap)', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room created')
    session.updateSettings(settings)
    const raw = await joinRaw(server, session.room!.code)
    cleanups.push(() => raw.transport.disconnect())
    raw.transport.send({ type: 'ready' })
    await until(
      () =>
        session.room?.players.length === 2 &&
        session.room.players.every((p) => p.ready || p.playerId === session.selfId),
      'ready'
    )
    session.startMatch()
    await until(() => session.phase === 'running', 'go')
    const matchId = matchIdOf(raw.events)

    // Batch 2 replays batch 1's events (overlap) and continues with 3-4.
    const first = [insertEvent(1, 0, 'a'), insertEvent(2, 10, 'b')]
    raw.sendBatch(matchId, first)
    raw.sendBatch(matchId, [...first, commitEvent(3, 20), insertEvent(4, 30, 'c')])

    const peer = (): PeerView => session.peers[0]
    // Applied exactly once, in order: commit advanced to word 1, buffer 'c'.
    // Wait for the LAST event's effect, not the commit's: the ghost's display
    // clock dispatches t=20 and t=30 ten display-ms apart, so asserting 'c'
    // right after wordIndex flips races the jitter buffer.
    await until(() => peer().view.snapshot.input[1] === 'c', 'post-duplicate events applied')
    expect(peer().status).not.toBe('desynced')
    expect(peer().view.wordIndex).toBe(1)
    expect(peer().view.snapshot.input[0]).toBe('ab')
  })

  it('survives a mid-match drop + resume: own batchSeq continuity, backlog applied once', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session, transport } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room created')
    session.updateSettings({ ...settings, wordCount: 4 })
    // Observer records every relayed self batch; the bot keeps typing while we are down.
    const observer = await joinRaw(server, session.room!.code)
    cleanups.push(() => observer.transport.disconnect())
    await addLoopbackBot(server, session.room!.code, { wpm: 200, loadDictionary })
    observer.transport.send({ type: 'ready' })
    await until(
      () =>
        session.room?.players.length === 3 &&
        session.room.players.every((p) => p.ready || p.playerId === session.selfId),
      'seats ready'
    )
    session.startMatch()
    await until(() => session.phase === 'running', 'go')
    const matchId = matchIdOf(observer.events)
    // The observer only spectates; it finishes immediately so the match can end.
    observer.transport.send({ type: 'finish', matchId })

    // Type half, then the server abruptly drops us mid-match.
    const words = session.selfView.words
    for (const word of words.slice(0, 2)) {
      for (const char of word) session.selfView.insert(char)
      session.selfView.commit()
    }
    server.dropClient(transport.playerId!)
    // Keep typing through the outage: batches park in the outbox, the run finishes locally.
    for (const word of words.slice(2)) {
      for (const char of word) session.selfView.insert(char)
      session.selfView.commit()
    }
    expect(session.selfView.finished).toBe(true)

    // Resume happens automatically (backoff ~10 ms); parked batches + finish drain.
    await until(() => session.phase === 'results', 'match completes across the drop', 20_000)

    // Own outgoing continuity: the observer saw every event exactly once, seq 1..N.
    const selfBatches = observer.events.filter(
      (event): event is Extract<TransportEvent, { type: 'peer_batch' }> =>
        event.type === 'peer_batch' && event.playerId === transport.playerId
    )
    const seqs = selfBatches.flatMap((batch) => batch.events.map((entry) => entry.seq))
    const expectedCount = words.reduce((sum, word) => sum + word.length + 1, 0)
    expect(seqs).toEqual(Array.from({ length: expectedCount }, (_, index) => index + 1))
    // No envelope rejections: a batchSeq gap would have produced bad_message.
    expect(session.lastError).toBeNull()

    // Inbound backlog (bot events buffered during our outage) applied once —
    // the bot's ghost is intact, not desynced, and completed its run.
    const botPeer = session.peers.find((peer) => peer.playerId !== observer.transport.playerId)!
    expect(botPeer.status).toBe('finished')
    expect(botPeer.view.finished).toBe(true)
    const rows = session.standings!
    expect(rows).toHaveLength(3)
    expect(rows.find((row) => row.isSelf)?.status).toBe('finished')
  })
})
