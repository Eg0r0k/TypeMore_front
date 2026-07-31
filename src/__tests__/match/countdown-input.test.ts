// Input during the 3-2-1 countdown is VOID: the session gates every sink call
// on phase === 'running', so keystrokes before GO never reach the local run
// (and can never leak into the outgoing event batches). The field-level side
// of the same rule — no sounds before GO — is covered by the room specs
// (countdown-lockout.test.ts).
import { createPinia, setActivePinia } from 'pinia'
import { until } from '../helpers/until'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Dictionary, dictVersion } from '@typemore/core'
import type { TimerCommand, TimerTick } from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import { type RoomSettings, LoopbackServer, LoopbackTransport } from '@shared/match-transport'
import { type MatchSessionStore, addLoopbackBot, useMatchSessionStore } from '@entities/match'

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  postMessage(_message: TimerCommand): void {}
  terminate(): void {}
}

const dict: Dictionary = {
  name: 'test',
  bcp47: 'xx',
  words: ['ab', 'cd', 'ef', 'gh', 'ij', 'kl', 'mn', 'op']
}
const loadDictionary = async (): Promise<Dictionary> => dict

const roomSettings = (): RoomSettings => ({
  name: 'Test room',
  visibility: 'private',
  mode: 'words',
  wordCount: 3,
  lang: 'xx',
  dictHash: dictVersion(dict.words),
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
  textSource: { kind: 'seeded' }
})

describe('countdown input probe', () => {
  let session: MatchSessionStore

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    session.dispose()
  })

  it('typing during countdown does not reach the local run', async () => {
    const server = new LoopbackServer({ countdownLeadMs: 2000 })
    const transport = new LoopbackTransport(server)
    session = useMatchSessionStore()
    await session.init(transport, {
      loadDictionary,
      createTimerWorker: () => new FakeTimerWorker()
    })

    session.createRoom()
    await until(() => session.room !== null, 'room_state after create_room')
    session.updateSettings(roomSettings())
    await addLoopbackBot(server, session.room!.code, { wpm: 60, seed: 1, loadDictionary })
    await until(() => (session.room?.players.length ?? 0) === 2, 'bot seated')
    session.startMatch()
    await until(() => session.phase === 'countdown', 'countdown')
    // Words should already be set up during countdown
    await until(() => session.selfView.words.length > 0, 'words ready')

    session.selfView.insert('a')
    session.selfView.insert('b')
    expect(session.phase).toBe('countdown')
    expect(session.selfView.snapshot.input[0] ?? '').toBe('')
  })
})
