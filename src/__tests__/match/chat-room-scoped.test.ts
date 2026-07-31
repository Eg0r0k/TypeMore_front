// The chat lives with the ROOM: entering a different room (a different code)
// clears the log, while room_state updates for the SAME room — settings
// changes, seats joining — leave it alone. Without the room-code guard the old
// lobby's history followed the player into every next room.
import { createPinia, setActivePinia } from 'pinia'
import { until } from '../helpers/until'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Dictionary, dictVersion } from '@typemore/core'
import type { TimerCommand, TimerTick } from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import { type RoomSettings, LoopbackServer, LoopbackTransport } from '@shared/match-transport'
import { type MatchSessionStore, useMatchSessionStore } from '@entities/match'

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  postMessage(_message: TimerCommand): void {}
  terminate(): void {}
}

const dict: Dictionary = {
  name: 'test',
  bcp47: 'xx',
  words: ['ab', 'cd', 'ef', 'gh']
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

describe('chat history is room-scoped', () => {
  let session: MatchSessionStore

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    session.dispose()
  })

  it('survives same-room updates, dies with the room', async () => {
    const server = new LoopbackServer()
    session = useMatchSessionStore()
    await session.init(new LoopbackTransport(server), {
      loadDictionary,
      createTimerWorker: () => new FakeTimerWorker()
    })

    session.createRoom()
    await until(() => session.room !== null, 'room_state after create_room')

    session.sendChat('hello from room A')
    await until(() => session.chatLog.length === 1, 'chat echo')

    // A room_state for the SAME room (settings update) keeps the log — the
    // update may itself append a system "settings changed" line, but the
    // player's message survives it.
    session.updateSettings(roomSettings())
    await until(() => session.room?.settings.wordCount === 3, 'settings applied')
    expect(session.chatLog.some((entry) => entry.text === 'hello from room A')).toBe(true)

    // A different room starts a clean chat.
    session.leaveRoom()
    session.createRoom()
    await until(() => session.room !== null, 'room_state after second create_room')
    expect(session.chatLog).toHaveLength(0)
  })
})
