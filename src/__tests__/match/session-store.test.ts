// Match session over the loopback wire: full create/join/ready/countdown/type/
// finish round-trips through the REAL client path (session store → WsTransport
// core → LoopbackServer), plus the MATCH.md standings rules.
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type Dictionary,
  type ModsDeclaration,
  type TimerCommand,
  type TimerTick,
  EVENT_LOG_VERSION,
  commitEvent,
  dictVersion,
  foldLog,
  generateWords,
  insertEvent,
  makeSeedContext,
  progressOf,
  scoreV2OfLog
} from '@shared/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import {
  type CountdownFrame,
  type Freemods,
  type RoomSettings,
  type TransportEvent,
  LoopbackServer,
  LoopbackTransport
} from '@shared/match-transport'
import {
  type MatchSessionStore,
  addLoopbackBot,
  freemodsConfig,
  matchGeneration,
  scoringGeneration,
  synthesizeBotLog,
  useMatchSessionStore
} from '@entities/match'

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  readonly sent: TimerCommand[] = []
  terminated = false

  postMessage(message: TimerCommand): void {
    this.sent.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emitTick(elapsedMs: number): void {
    this.onmessage?.({ data: { type: 'tick', elapsedMs } } as unknown as MessageEvent<TimerTick>)
  }
}

const dict: Dictionary = {
  name: 'test',
  bcp47: 'xx',
  words: ['ab', 'cd', 'ef', 'gh', 'ij', 'kl', 'mn', 'op']
}
const loadDictionary = async (): Promise<Dictionary> => dict
const NO_DECLARATION: ModsDeclaration = { blind: false, fading: false, flashlight: false }

const roomSettings = (overrides: Partial<RoomSettings> = {}): RoomSettings => ({
  name: 'Test room',
  visibility: 'private',
  mode: 'words',
  wordCount: 3,
  lang: 'xx',
  dictHash: dictVersion(dict.words),
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'seeded' },
  ...overrides
})

/**
 * Real-timer polling — deliberate: these are integration tests of a timing
 * protocol (NTP offset sampling, `goAtServerMs` scheduling, ≤100 ms batch
 * cadence, reconnect backoff), where Date.now/performance.now/setTimeout must
 * stay mutually consistent; vitest's fake timers do not fake performance.now
 * by default, and splitting the clocks desyncs the match anchor.
 */
async function until(cond: () => boolean, label: string, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now()
  while (!cond()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`timed out waiting for ${label}`)
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 5)
    await promise
  }
}

interface Harness {
  session: MatchSessionStore
  transport: LoopbackTransport
  workers: FakeTimerWorker[]
}

async function createSession(server: LoopbackServer): Promise<Harness> {
  const transport = new LoopbackTransport(server)
  const session = useMatchSessionStore()
  const workers: FakeTimerWorker[] = []
  await session.init(transport, {
    loadDictionary,
    createTimerWorker: () => {
      const worker = new FakeTimerWorker()
      workers.push(worker)
      return worker
    },
    ghostDelayMs: 50 // small jitter buffer so ghost displays settle fast in tests
  })
  return { session, transport, workers }
}

/** Host path: create room, apply settings (+ the host's own freemods), seat `bots`, start the match. */
async function hostMatch(
  server: LoopbackServer,
  session: MatchSessionStore,
  settings: RoomSettings,
  botWpms: number[],
  freemods?: Freemods
): Promise<void> {
  session.createRoom()
  await until(() => session.room !== null, 'room_state after create_room')
  session.updateSettings(settings)
  // Freemods go on the wire BEFORE start_match: the countdown freezes each
  // seat's rules, and the local run is configured from that frozen copy.
  if (freemods !== undefined) {
    session.setFreemods(freemods)
    await until(() => {
      const self = session.room?.players.find((player) => player.playerId === session.selfId)
      return (
        self?.freemods.difficulty === freemods.difficulty &&
        self?.freemods.minWpm === freemods.minWpm
      )
    }, 'own freemods on the seat')
  }
  for (const [index, wpm] of botWpms.entries()) {
    await addLoopbackBot(server, session.room!.code, { wpm, seed: index + 1, loadDictionary })
  }
  await until(() => {
    const players = session.room?.players ?? []
    return (
      players.length === botWpms.length + 1 &&
      players.every((p) => p.ready || p.playerId === session.selfId)
    )
  }, 'all bots seated and ready')
  session.startMatch()
  await until(() => session.phase === 'running', 'go')
}

function typeOwnRun(session: MatchSessionStore, wordCount = Number.POSITIVE_INFINITY): void {
  const words = session.selfView.words.slice(0, wordCount)
  for (const word of words) {
    for (const char of word) session.selfView.insert(char)
    session.selfView.commit()
  }
}

describe('match session store (loopback)', () => {
  let cleanups: Array<() => void> = []

  beforeEach(() => {
    setActivePinia(createPinia())
    cleanups = []
  })

  afterEach(() => {
    for (const cleanup of cleanups) cleanup()
  })

  it('runs a full 2-player words match: lobby → countdown → run → results ranked by log finish time', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    expect(session.connection).toBe('idle')
    await hostMatch(server, session, roomSettings(), [600])
    expect(session.countdownMsLeft).toBeNull()
    expect(session.peers).toHaveLength(1)

    // Local run: input → core → batcher → wire; finish is sent automatically.
    typeOwnRun(session)
    expect(session.selfView.finished).toBe(true)

    await until(() => session.phase === 'results', 'match end')
    const rows = session.standings!
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.rank)).toEqual([1, 2])
    expect(rows.every((row) => row.status === 'finished')).toBe(true)
    // Words mode ranks by the LOG's completion instant — the instant typing
    // above finishes in a few ms of run time, far ahead of the 600 wpm bot.
    expect(rows[0].isSelf).toBe(true)
    expect(rows[0].finishTimeMs!).toBeLessThan(rows[1].finishTimeMs!)
    expect(rows[1].wpm!).toBeGreaterThan(0)
    expect(rows[1].acc!).toBe(1)
    expect(rows[1].freemods).toEqual({ difficulty: 'normal', minWpm: 0, nospace: false })
    // The bot's ghost consumed the relayed stream.
    expect(session.peers[0].status).toBe('finished')
    expect(session.peers[0].view.finished).toBe(true)
  })

  it("enters 'waiting' after own finish while others race; 'results' only on match_end (Δ3)", async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    await hostMatch(server, session, roomSettings(), [60]) // slow bot: ~2 s to finish
    typeOwnRun(session)
    expect(session.selfView.finished).toBe(true)

    // Δ3: our own finish must NOT enter results — the server owns match end.
    await until(() => session.phase === 'waiting', 'waiting phase after own finish')
    expect(session.standings).toBeNull()
    expect(session.matchEndReason).toBeNull()
    expect(session.peers[0].status).toBe('racing') // the ghost keeps racing on screen

    await until(() => session.phase === 'results', 'match_end → results')
    expect(session.matchEndReason).toBe('all_finished')
    expect(session.standings).toHaveLength(2)
    expect(session.standings!.every((row) => row.status === 'finished')).toBe(true)
  })

  it('runs a full 5-player words match and ranks every finisher', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    await hostMatch(server, session, roomSettings(), [700, 600, 500, 400])
    expect(session.peers).toHaveLength(4)

    typeOwnRun(session)
    await until(() => session.phase === 'results', '5-player match end', 20_000)

    const rows = session.standings!
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5])
    expect(rows.every((row) => row.status === 'finished')).toBe(true)
    expect(rows.filter((row) => row.isSelf)).toHaveLength(1)
    // Finish times strictly ordered per the words-mode rule.
    const times = rows.map((row) => row.finishTimeMs!)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    // Every ghost drained its relayed log.
    expect(session.peers.every((peer) => peer.status === 'finished')).toBe(true)
  })

  it("time mode ranks by scoreV2 under each player's OWN frozen freemods", async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session, workers } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room_state after create_room')
    session.updateSettings(roomSettings({ mode: 'time', durationMs: 1500, wordCount: undefined }))

    // Scripted opponent with EXPERT freemods (a real wire client, not a bot).
    const raw = new LoopbackTransport(server)
    const rawEvents: TransportEvent[] = []
    raw.onEvent((event) => rawEvents.push(event))
    await raw.connect()
    cleanups.push(() => raw.disconnect())
    raw.send({ type: 'join_room', code: session.room!.code })
    await until(() => raw.state === 'in_room', 'raw client seated')
    const expertMods = { difficulty: 'expert' as const, minWpm: 0 as const, nospace: false }
    raw.send({ type: 'set_freemods', freemods: expertMods })
    raw.send({ type: 'ready' })
    await until(
      () => session.room?.players.some((p) => p.playerId === raw.playerId && p.ready) === true,
      'raw ready'
    )

    session.startMatch()
    await until(() => session.phase === 'running', 'go')
    const countdown = rawEvents.find(
      (event): event is CountdownFrame => event.type === 'countdown'
    )!

    // The raw client races from the same server-dictated snapshot.
    const generation = matchGeneration(countdown.settings)!
    const generated = generateWords(
      dict,
      makeSeedContext(dict, countdown.seed, generation)
    )._unsafeUnwrap()
    const rawLog = synthesizeBotLog(generated.words, { wpm: 900, seed: 5, maxDurationMs: 1400 })
    for (let index = 0; index * 16 < rawLog.length; index++) {
      raw.send({
        type: 'event_batch',
        matchId: countdown.matchId,
        playerId: raw.playerId!,
        batchSeq: index + 1,
        version: EVENT_LOG_VERSION,
        events: rawLog.slice(index * 16, index * 16 + 16)
      })
    }
    raw.send({ type: 'finish', matchId: countdown.matchId })

    // Self types two words, then the deadline settles the run. TWO workers now
    // exist: [0] the LOCAL run's timer (created in onCountdown), [1] the
    // session-owned MATCH clock (ghost fan-out cadence, alive past our finish).
    typeOwnRun(session, 2)
    expect(workers).toHaveLength(2)
    workers[1].emitTick(1600) // match clock: ghost cadence only — never the local run
    expect(session.selfView.finished).toBe(false)
    workers[0].emitTick(1600)
    expect(session.selfView.finished).toBe(true)

    await until(() => session.phase === 'results', 'time-mode match end')
    const rows = session.standings!
    expect(rows).toHaveLength(2)
    // Time mode carries no finish-time rank input.
    expect(rows.every((row) => row.finishTimeMs === undefined)).toBe(true)

    const rawRow = rows.find((row) => row.playerId === raw.playerId)!
    const selfRow = rows.find((row) => row.isSelf)!
    expect(rawRow.freemods).toEqual(expertMods)
    expect(selfRow.freemods).toEqual({ difficulty: 'normal', minWpm: 0, nospace: false })

    // The opponent's score is recomputed from its LOG under ITS config
    // (expert multiplier included) — exact-value check against scoreV2OfLog.
    const expected = scoreV2OfLog(
      rawLog,
      {
        config: freemodsConfig(countdown.settings, expertMods),
        words: generated.words,
        generation: scoringGeneration(generation)
      },
      NO_DECLARATION
    ).total
    expect(rawRow.score).toBe(expected)
    // 900 wpm over the full window beats two words — ranking follows the score.
    expect(rawRow.score!).toBeGreaterThan(selfRow.score!)
    expect(rawRow.rank).toBe(1)
    expect(selfRow.rank).toBe(2)
  })

  it('blocks the match on a dictionary hash mismatch — reported, never adapted', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room_state after create_room')
    session.updateSettings(roomSettings({ dictHash: 'deadbeef' }))
    await addLoopbackBot(server, session.room!.code, { wpm: 0, loadDictionary })
    await until(() => (session.room?.players.length ?? 0) === 2, 'bot seated')
    await until(
      () => session.room!.players.every((p) => p.ready || p.playerId === session.selfId),
      'bot ready'
    )
    session.startMatch()

    await until(() => session.phase === 'error', 'blocking dict-hash error')
    expect(session.matchError?.kind).toBe('dict-hash-mismatch')
    expect(session.matchError?.message).toContain('deadbeef')
    expect(session.selfView.words).toHaveLength(0) // no run was set up
  })

  it('a timed run settles at the deadline with ZERO input and still reports finish', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session, workers } = await createSession(server)
    cleanups.push(() => session.dispose())

    await hostMatch(
      server,
      session,
      roomSettings({ mode: 'time', durationMs: 1500, wordCount: undefined }),
      [600]
    )

    // Not one keystroke: the match start policy makes the run live from the go
    // instant, so the local timer alone has to carry it to the deadline.
    expect(session.selfView.snapshot.phase).toBe('running')
    expect(session.selfView.snapshot.startedAt).toBe(0)
    workers[0].emitTick(1600)
    expect(session.selfView.finished).toBe(true)
    expect(session.selfView.snapshot.finishedAt).toBe(1500) // the deadline, not the tick instant
    expect(session.selfView.snapshot.failReason).toBeNull()

    // A clean finish is not an elimination…
    await until(() => session.phase === 'waiting', 'waiting after the idle deadline')
    // …and the `finish` we sent is what lets the server end the match at all.
    await until(() => session.phase === 'results', 'match end after an idle run')

    const rows = session.standings!
    const selfRow = rows.find((row) => row.isSelf)!
    expect(selfRow.status).toBe('finished')
    expect(selfRow.failReason).toBeUndefined()
    expect(selfRow.wpm).toBe(0)
    expect(selfRow.acc).toBe(0)
    expect(selfRow.progress).toBe(0) // canonical progress: not a single target char
    expect(selfRow.score).toBeUndefined() // an empty log has nothing to score
    for (const row of rows) {
      expect(Number.isFinite(row.wpm)).toBe(true)
      expect(Number.isFinite(row.acc)).toBe(true)
      expect(Number.isFinite(row.progress)).toBe(true)
      expect(row.score === undefined || Number.isFinite(row.score)).toBe(true)
    }

    // The opponent raced and settled on its own clock, untouched by our idling.
    const ghost = session.peers[0]
    expect(ghost.status).toBe('finished')
    expect(ghost.view.finished).toBe(true)
    expect(ghost.failReason).toBeNull()
    expect(ghost.metrics.wpm).toBeGreaterThan(0)
    expect(rows.find((row) => !row.isSelf)!.wpm!).toBeGreaterThan(0)
  })

  it('the MinSpeed floor eliminates the local player, who spectates on to match_end', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session, workers } = await createSession(server)
    cleanups.push(() => session.dispose())

    // The deadline (4 s) sits behind the floor instant (the 3 s grace on an
    // empty log), so MinSpeed — not the clock — is what ends this run.
    const settings = roomSettings({ mode: 'time', durationMs: 4000, wordCount: undefined })
    await hostMatch(server, session, settings, [1200], {
      difficulty: 'normal',
      minWpm: 60,
      nospace: false
    })

    workers[0].emitTick(3100)
    await until(() => session.phase === 'eliminated', 'eliminated by the MinSpeed floor')
    expect(session.selfView.snapshot.failReason).toBe('minSpeed')
    expect(session.selfView.snapshot.finishedAt).toBe(3000) // the floor instant, not the tick

    const outcome = session.selfOutcome
    expect(outcome).not.toBeNull()
    expect(outcome!.reason).toBe('minSpeed')
    expect(Number.isFinite(outcome!.wpm)).toBe(true)
    expect(Number.isFinite(outcome!.acc)).toBe(true)
    expect(Number.isFinite(outcome!.progress)).toBe(true)
    expect(outcome!.score === null || Number.isFinite(outcome!.score)).toBe(true)

    // Out of the race, still on the wire: peer_batch keeps arriving and the
    // session's own match clock keeps the ghost advancing.
    expect(session.connection).toBe('in_match')
    const progress = session.peers[0].metrics.progress
    const wordIndex = session.peers[0].view.wordIndex
    await until(
      () =>
        session.peers[0].metrics.progress > progress && session.peers[0].view.wordIndex > wordIndex,
      'the opponent ghost advances after the local elimination'
    )

    await until(() => session.phase === 'results', 'match end after the local elimination')
    expect(session.matchEndReason).toBe('all_finished')
    const rows = session.standings!
    expect(rows[0].isSelf).toBe(false) // the finisher outranks the eliminated seat
    expect(rows[0].failReason).toBeUndefined()
    expect(rows[1].isSelf).toBe(true)
    expect(rows[1].rank).toBe(2)
    expect(rows[1].failReason).toBe('minSpeed')
  })

  it('master difficulty: a wrong keystroke eliminates the local player, ranked below the finisher', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    await hostMatch(server, session, roomSettings(), [600], {
      difficulty: 'master',
      minWpm: 0,
      nospace: false
    })

    // 'z' is absent from the test dictionary — a certain miss on any word.
    session.selfView.insert('z')
    expect(session.selfView.finished).toBe(true)
    expect(session.selfView.snapshot.failReason).toBe('master')

    await until(() => session.phase === 'eliminated', 'eliminated by the master rule')
    const outcome = session.selfOutcome
    expect(outcome).not.toBeNull()
    expect(outcome!.reason).toBe('master')
    expect(Number.isFinite(outcome!.wpm)).toBe(true)
    expect(Number.isFinite(outcome!.acc)).toBe(true)
    expect(Number.isFinite(outcome!.progress)).toBe(true)
    expect(session.connection).toBe('in_match')

    await until(() => session.phase === 'results', 'match end after the local elimination')
    const rows = session.standings!
    expect(rows).toHaveLength(2)
    // MATCH.md §1 tiers: a true finisher outranks anyone knocked out by a
    // freemod rule, even though the wire calls both of them `finished`.
    expect(rows[0].isSelf).toBe(false)
    expect(rows[0].rank).toBe(1)
    expect(rows[0].status).toBe('finished')
    expect(rows[0].failReason).toBeUndefined()
    expect(rows[0].finishTimeMs!).toBeGreaterThan(0)
    expect(rows[1].isSelf).toBe(true)
    expect(rows[1].rank).toBe(2)
    expect(rows[1].status).toBe('finished')
    expect(rows[1].failReason).toBe('master')
    expect(rows[1].finishTimeMs).toBeUndefined()
  })

  it('two eliminated players rank by canonical progress, further-through first', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room_state after create_room')
    session.updateSettings(roomSettings())
    const master: Freemods = { difficulty: 'master', minWpm: 0, nospace: false }
    session.setFreemods(master)

    // A second master seat, driven straight off the wire so its log is ours to write.
    const raw = new LoopbackTransport(server)
    const rawEvents: TransportEvent[] = []
    raw.onEvent((event) => rawEvents.push(event))
    await raw.connect()
    cleanups.push(() => raw.disconnect())
    raw.send({ type: 'join_room', code: session.room!.code })
    await until(() => raw.state === 'in_room', 'raw client seated')
    raw.send({ type: 'set_freemods', freemods: master })
    raw.send({ type: 'ready' })
    await until(
      () =>
        session.room?.players.every((player) => player.freemods.difficulty === 'master') === true,
      'both seats on master'
    )
    await until(
      () => session.room?.players.some((p) => p.playerId === raw.playerId && p.ready) === true,
      'raw ready'
    )

    session.startMatch()
    await until(() => session.phase === 'running', 'go')
    const countdown = rawEvents.find(
      (event): event is CountdownFrame => event.type === 'countdown'
    )!

    // Self: one word committed correctly, then a miss — 3 of the 6 target chars.
    typeOwnRun(session, 1)
    session.selfView.insert('z')
    expect(session.selfView.snapshot.failReason).toBe('master')
    // The raw seat misses on its very first keystroke — 1 of 6.
    raw.send({
      type: 'event_batch',
      matchId: countdown.matchId,
      playerId: raw.playerId!,
      batchSeq: 1,
      version: EVENT_LOG_VERSION,
      events: [insertEvent(1, 20, 'z')]
    })
    raw.send({ type: 'finish', matchId: countdown.matchId })

    await until(() => session.phase === 'results', 'match end with two eliminated seats')
    const rows = session.standings!
    expect(rows.map((row) => row.rank)).toEqual([1, 2])
    expect(rows.every((row) => row.status === 'finished')).toBe(true)
    expect(rows.every((row) => row.failReason === 'master')).toBe(true)
    expect(rows.every((row) => row.finishTimeMs === undefined)).toBe(true)
    expect(rows[0].isSelf).toBe(true)
    expect(rows[0].progress).toBeGreaterThan(rows[1].progress)
    // Both ghosts and rows read the same canonical progress definition.
    expect(session.peers[0].failReason).toBe('master')
    expect(session.peers[0].status).toBe('eliminated')
  })

  it('the server AFK-share rule dnfs a silent seat; the standings row carries its share', async () => {
    // Warm-up 1 s ⇒ the rule bites on the first fully-idle one-second bucket.
    const server = new LoopbackServer({ countdownLeadMs: 40, afkWarmupMs: 1000 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    // `wpm: 0` seats a bot that readies and then never types a single event.
    await hostMatch(server, session, roomSettings(), [0])
    typeOwnRun(session) // the local seat is active in its very first bucket
    await until(() => session.phase === 'waiting', 'own finish while the silent bot idles')

    await until(() => session.phase === 'results', 'the AFK rule ends the match', 5000)
    expect(session.matchEndReason).toBe('all_finished') // the kick, not the finish window
    expect(session.peers[0].status).toBe('dnf')

    const rows = session.standings!
    const selfRow = rows.find((row) => row.isSelf)!
    const botRow = rows.find((row) => !row.isSelf)!
    expect(botRow.status).toBe('dnf')
    // Server-measured, arrival-derived: a whole idle bucket for the bot, none
    // for the seat that typed and finished inside its first one.
    expect(botRow.afkShare).toBe(1)
    expect(selfRow.afkShare).toBe(0)
  })

  it('over-typed extras move a peer nowhere: caret clamps to the target, progress matches a clean run', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { session } = await createSession(server)
    cleanups.push(() => session.dispose())

    session.createRoom()
    await until(() => session.room !== null, 'room_state after create_room')
    session.updateSettings(roomSettings())

    const raw = new LoopbackTransport(server)
    const rawEvents: TransportEvent[] = []
    raw.onEvent((event) => rawEvents.push(event))
    await raw.connect()
    cleanups.push(() => raw.disconnect())
    raw.send({ type: 'join_room', code: session.room!.code })
    await until(() => raw.state === 'in_room', 'raw client seated')
    raw.send({ type: 'ready' })
    await until(
      () => session.room?.players.some((p) => p.playerId === raw.playerId && p.ready) === true,
      'raw ready'
    )

    session.startMatch()
    await until(() => session.phase === 'running', 'go')
    const countdown = rawEvents.find(
      (event): event is CountdownFrame => event.type === 'countdown'
    )!
    const words = session.selfView.words

    // The peer commits word 0 correctly, then types word 1 in full plus FIVE
    // extra characters — its caret sits 5 columns past the word on its own
    // screen, but it has not advanced a single target position.
    const events = [
      insertEvent(1, 10, words[0][0]),
      insertEvent(2, 20, words[0][1]),
      commitEvent(3, 30),
      insertEvent(4, 40, words[1][0]),
      insertEvent(5, 50, words[1][1]),
      ...[...'xxxxx'].map((char, index) => insertEvent(6 + index, 60 + index * 10, char))
    ]
    raw.send({
      type: 'event_batch',
      matchId: countdown.matchId,
      playerId: raw.playerId!,
      batchSeq: 1,
      version: EVENT_LOG_VERSION,
      events
    })
    await until(
      () => (session.peers[0].view.snapshot.input[1] ?? '').length === words[1].length + 5,
      'extras applied to the ghost'
    )

    const peer = session.peers[0]
    // Caret: clamped to the target word, NOT the 7 characters actually typed.
    expect(peer.view.snapshot.input[1]).toHaveLength(words[1].length + 5)
    expect(peer.caret).toEqual({ wordIndex: 1, charIndex: words[1].length })
    // Progress: identical to the same position typed without a single extra.
    const ctx = {
      config: freemodsConfig(countdown.settings, {
        difficulty: 'normal',
        minWpm: 0,
        nospace: false
      }),
      words
    }
    const clean = foldLog(ctx, events.slice(0, 5))._unsafeUnwrap()
    expect(peer.metrics.progress).toBe(progressOf(ctx, clean))
    // …and it is the local player's own definition too (self/peer parity).
    typeOwnRun(session, 1)
    for (const char of words[1].slice(0, 2)) session.selfView.insert(char)
    for (const char of 'xxxxx') session.selfView.insert(char)
    expect(progressOf(ctx, session.selfView.snapshot)).toBe(peer.metrics.progress)
  })
})
