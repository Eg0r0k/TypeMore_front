// Δ2 reload-resume at the session-store level: the resume token persists in
// sessionStorage (per-tab), a fresh store instance (= page reload) reclaims the
// seat, and kick/leave clear the token so a reload cannot resurrect the seat.
// Mid-match the reclaim is a FORFEIT — see `forfeitStaleSeat` in the store.
import { createPinia, setActivePinia } from 'pinia'
import { until } from '../helpers/until'
import { watch } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { type Dictionary, type TimerCommand, type TimerTick, dictVersion } from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import {
  type ClientCommand,
  type RoomSettings,
  type TransportEvent,
  LoopbackServer,
  LoopbackTransport
} from '@shared/match-transport'
import { type MatchPhase, type MatchSessionStore, useMatchSessionStore } from '@entities/match'

const dict: Dictionary = { name: 'test', bcp47: 'xx', words: ['ab', 'cd', 'ef', 'gh'] }
const loadDictionary = async (): Promise<Dictionary> => dict

/** No real Worker in jsdom: the match clock only needs a tick source, and these tests drive none. */
class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null

  postMessage(_message: TimerCommand): void {
    /* the run's own deadline never fires in these words-mode tests */
  }

  terminate(): void {
    /* nothing to release */
  }
}

const sessionOptions = () => ({
  loadDictionary,
  createTimerWorker: () => new FakeTimerWorker(),
  ghostDelayMs: 50
})

const wordsSettings: RoomSettings = {
  name: 'Reload room',
  visibility: 'private',
  mode: 'words',
  wordCount: 3,
  lang: 'xx',
  dictHash: dictVersion(dict.words),
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'seeded' }
}

/**
 * Real-timer polling — deliberate: same rationale as session-store.test.ts
 * (NTP sampling and loopback delivery must share one consistent clock).
 */
/**
 * A raw wire client — the opponent seat. A second SESSION store cannot coexist
 * with the one under test: `MATCH_SESSION_STORE_ID` is a single global
 * game-store id, so two sessions would race over one local core.
 */
interface RawClient {
  t: LoopbackTransport
  events: TransportEvent[]
}

const ofType = <T extends TransportEvent['type']>(client: RawClient, type: T) =>
  client.events.filter(
    (event): event is Extract<TransportEvent, { type: T }> => event.type === type
  )

/** A transport that records everything the store sends — the forfeit's `finish` is counted here. */
function spyTransport(server: LoopbackServer): {
  transport: LoopbackTransport
  sent: ClientCommand[]
} {
  const transport = new LoopbackTransport(server)
  const sent: ClientCommand[] = []
  const send = transport.send.bind(transport)
  transport.send = (frame: ClientCommand) => {
    sent.push(frame)
    send(frame)
  }
  return { transport, sent }
}

/**
 * A words match with two seats: a raw host client and the session store under
 * test. Only the store touches sessionStorage, so the stored resume token is
 * unambiguously the seat we are about to reload.
 */
async function racingSeat(
  server: LoopbackServer
): Promise<{ opponent: RawClient; guest: MatchSessionStore; matchId: string }> {
  const opponent: RawClient = { t: new LoopbackTransport(server), events: [] }
  opponent.t.onEvent((event) => opponent.events.push(event))
  await opponent.t.connect()
  opponent.t.send({ type: 'create_room' })
  await until(() => ofType(opponent, 'room_state').length > 0, 'room after create')
  // Settings BEFORE the guest readies: applying them resets every ready flag.
  opponent.t.send({ type: 'settings_update', settings: wordsSettings })
  await until(
    () => ofType(opponent, 'room_state').at(-1)!.settings.mode === 'words',
    'words settings applied'
  )
  const code = ofType(opponent, 'room_state').at(-1)!.code

  const guest = useMatchSessionStore()
  await guest.init(new LoopbackTransport(server), sessionOptions())
  guest.joinRoom(code)
  await until(() => guest.room !== null, 'guest seated')
  guest.setReady()
  await until(
    () =>
      (guest.room?.players ?? []).some(
        (player) => player.playerId === guest.selfId && player.ready
      ),
    'guest ready'
  )

  opponent.t.send({ type: 'start_match' })
  await until(() => guest.phase === 'running', 'the guest seat is racing')
  return { opponent, guest, matchId: ofType(opponent, 'countdown').at(-1)!.matchId }
}

describe('reload-resume (Δ2)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('a fresh store on the same server reclaims the room via the stored token', async () => {
    const server = new LoopbackServer()

    const first = useMatchSessionStore()
    await first.init(new LoopbackTransport(server), { loadDictionary })
    first.createRoom()
    await until(() => first.room !== null, 'room after create')
    const code = first.room!.code
    const hostId = first.selfId!
    expect(sessionStorage.getItem('typemore:matchResume')).not.toBeNull()

    // Page reload: the old tab's transport dies (unintentional from the
    // server's view), a brand-new pinia + store boots against the same server.
    first.dispose()
    setActivePinia(createPinia())
    const second = useMatchSessionStore()
    await second.init(new LoopbackTransport(server), { loadDictionary })
    expect(second.resumeAttempted).toBe(true)
    await until(() => second.room !== null, 'room after resume')

    expect(second.room!.code).toBe(code)
    expect(second.selfId).toBe(hostId)
    expect(second.room!.hostPlayerId).toBe(hostId) // host role survived the reload
    expect(second.phase).toBe('lobby')
  })

  it('an intentional leave clears the stored token — reload stays out', async () => {
    const server = new LoopbackServer()

    const first = useMatchSessionStore()
    await first.init(new LoopbackTransport(server), { loadDictionary })
    first.createRoom()
    await until(() => first.room !== null, 'room after create')
    first.leaveRoom()
    expect(sessionStorage.getItem('typemore:matchResume')).toBeNull()
    first.dispose()

    setActivePinia(createPinia())
    const second = useMatchSessionStore()
    await second.init(new LoopbackTransport(server), { loadDictionary })
    expect(second.resumeAttempted).toBe(false)
    expect(second.room).toBeNull()
  })

  it('a mid-match reload forfeits the stale seat and lets the match end at once', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { opponent, guest, matchId } = await racingSeat(server)
    const guestId = guest.selfId!

    // The opponent finishes first: from here the ONLY thing between everyone
    // and the results is our seat, which the server still calls `racing`.
    opponent.t.send({ type: 'finish', matchId })

    // Reload: the tab's JS state (log, seq, t=0 anchor) is gone for good.
    guest.dispose()
    setActivePinia(createPinia())
    const reloaded = useMatchSessionStore()
    const { transport, sent } = spyTransport(server)
    // Synchronous watcher: the forfeit and the match_end it provokes can land
    // in the same tick, so `eliminated` is only observable as a transition.
    const phases: MatchPhase[] = []
    watch(
      () => reloaded.phase,
      (next) => phases.push(next),
      { flush: 'sync' }
    )
    await reloaded.init(transport, sessionOptions())

    // Promptly: no hard deadline, no 120 s finish window, no AFK warm-up — the
    // forfeit was the last outstanding seat, so the match ends right there.
    await until(() => ofType(opponent, 'match_end').length === 1, 'the opponent moves on', 3000)
    expect(phases).toEqual(['lobby', 'eliminated', 'results'])
    expect(reloaded.selfId).toBe(guestId) // the same seat, reclaimed
    expect(reloaded.selfOutcome).toEqual({
      reason: 'reload',
      wpm: 0,
      acc: 0,
      score: null,
      progress: 0
    })
    // The forfeit is explicit on the wire: no result stands behind it, so the
    // server records the seat `dnf` instead of a phantom finisher.
    expect(sent.filter((frame) => frame.type === 'finish')).toEqual([
      { type: 'finish', matchId, forfeit: true }
    ])

    const end = ofType(opponent, 'match_end')[0]
    expect(end.reason).toBe('all_finished')
    expect(end.results.find((result) => result.playerId === guestId)!.status).toBe('dnf')
    expect(opponent.t.state).toBe('in_room')

    // The reloaded tab sees a real table too — no countdown snapshot and no
    // log, but the wire carries enough to show who was in the match.
    await until(() => reloaded.phase === 'results', 'results on the reloaded tab', 3000)
    const rows = reloaded.standings!
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.rank)).toEqual([1, 2])
    const selfRow = rows.find((row) => row.isSelf)!
    expect(selfRow.playerId).toBe(guestId)
    expect(selfRow.nick).toBe(
      reloaded.room!.players.find((player) => player.playerId === guestId)!.nick
    )
    expect(selfRow.progress).toBe(0)
    expect(selfRow.wpm).toBeUndefined() // no log survived the reload — no metrics invented
    expect(selfRow.score).toBeUndefined()
    expect(typeof selfRow.afkShare).toBe('number')

    opponent.t.disconnect()
    reloaded.dispose()
  })

  it('the forfeit is sent once, not on every room_state', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 40 })
    const { opponent, guest } = await racingSeat(server)

    guest.dispose()
    setActivePinia(createPinia())
    const reloaded = useMatchSessionStore()
    const { transport, sent } = spyTransport(server)
    await reloaded.init(transport, sessionOptions())
    await until(() => reloaded.phase === 'eliminated', 'forfeited on the resumed room_state')

    // The opponent is still racing, so the match — and its `room_state.match`
    // descriptor — lives on. Two more mid-match room_state broadcasts must not
    // produce a second `finish` (the server would reject it as bad_message).
    opponent.t.send({ type: 'ready', ready: false })
    opponent.t.send({ type: 'ready', ready: true })
    await until(
      () =>
        (reloaded.room?.players ?? []).some(
          (player) => player.playerId === opponent.t.playerId && player.ready
        ),
      'two more mid-match room_state frames'
    )

    expect(sent.filter((frame) => frame.type === 'finish')).toHaveLength(1)
    expect(reloaded.phase).toBe('eliminated')
    expect(reloaded.lastError).toBeNull() // no rejected duplicate finish came back

    opponent.t.disconnect()
    reloaded.dispose()
  })
})
