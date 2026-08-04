import { computed } from 'vue'

import type { RoomSettings } from '@/entities/lobby'
import { useMatchSessionStore } from '@/entities/match'

/**
 * The room's settings and the one way to write them.
 *
 * It is a composable rather than a helper on each surface because the settings
 * are edited from TWO places now — the identity block beside the room code and
 * the run configuration below it — and the normalisation below is what the
 * server would otherwise reject. Two copies of it would be two chances to send
 * a frame that fails validation.
 */
const FALLBACK_SETTINGS: RoomSettings = {
  name: '',
  visibility: 'private',
  mode: 'time',
  durationMs: 30000,
  lang: 'english',
  dictHash: '',
  textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false, lazy: false },
  textSource: { kind: 'seeded' }
}

export function useRoomSettings() {
  const session = useMatchSessionStore()
  const room = computed(() => session.room)
  const settings = computed<RoomSettings>(() => room.value?.settings ?? FALLBACK_SETTINGS)

  const apply = (patch: Partial<RoomSettings>): void => {
    const next: RoomSettings = { ...settings.value, ...patch }
    // `durationMs` / `wordCount` are mode-conditional on the wire (§5): send
    // only the active one. A quote carries `wordCount` too — the length of the
    // text it drew — and its own patch always supplies it.
    if (next.mode === 'time') {
      next.durationMs = next.durationMs ?? 30000
      delete next.wordCount
    } else {
      next.wordCount = next.wordCount ?? 25
      delete next.durationMs
    }
    // Leaving quote mode leaves its source behind with it: a seeded room with a
    // quote source is rejected by the server, and rightly so.
    if (next.mode !== 'quote' && next.textSource.kind === 'quote') {
      next.textSource = { kind: 'seeded' }
    }
    session.updateSettings(next)
  }

  return { session, room, settings, apply }
}
