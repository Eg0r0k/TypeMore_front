/**
 * The lobby presence check — "are you still there?".
 *
 * It exists because a seat held by an abandoned tab keeps a room alive and in
 * the public list forever, and the SERVER cannot tell that seat from a host
 * legitimately waiting for players (waiting produces no traffic at all). So the
 * three things worth pinning are: the two conditions are AND-ed (an idle tab
 * somebody is looking at keeps its seat), it never runs outside the lobby, and
 * when it fires it leaves through the ORDINARY path — no new wire message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useLobbyPresence, type LobbyPresence } from '@/features/room/presence'

const IDLE_MS = 1000
const GRACE_MS = 300

let visibility: DocumentVisibilityState = 'visible'
let focused = true

/** Runs the composable inside a scope so its listeners can be torn down. */
const withPresence = (armed: ReturnType<typeof ref<boolean>>) => {
  const scope = effectScope()
  let presence!: LobbyPresence
  const leave = vi.fn()
  scope.run(() => {
    presence = useLobbyPresence({
      armed: armed as never,
      leave,
      idleMs: IDLE_MS,
      graceMs: GRACE_MS
    })
  })
  return { presence, leave, stop: () => scope.stop() }
}

const goAway = (): void => {
  visibility = 'hidden'
  focused = false
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  focused = true
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('lobby presence', () => {
  it('leaves the seat when the tab has been idle AND away', async () => {
    const armed = ref(true)
    const { presence, leave, stop } = withPresence(armed)
    await nextTick()

    goAway()
    vi.advanceTimersByTime(IDLE_MS)
    await nextTick()
    expect(presence.prompting.value).toBe(true)
    expect(presence.secondsLeft.value).toBeGreaterThan(0)
    expect(leave).not.toHaveBeenCalled()

    // The countdown is polled (it renders whole seconds), so the deadline is
    // acted on at the first tick past it — hence one poll interval of slack.
    vi.advanceTimersByTime(GRACE_MS + 250)
    // The ordinary leave — the same call the leave button makes. Nothing new
    // travels on the wire, so the room empties by the path that already exists.
    expect(leave).toHaveBeenCalledOnce()
    expect(presence.prompting.value).toBe(false)

    stop()
  })

  it('never prompts a tab somebody is looking at, however idle', async () => {
    const armed = ref(true)
    const { presence, leave, stop } = withPresence(armed)
    await nextTick()

    // Visible and focused: this is a host watching an empty player list, and
    // asking them to prove they exist is the bug this AND avoids.
    vi.advanceTimersByTime(IDLE_MS * 5)
    await nextTick()
    expect(presence.prompting.value).toBe(false)
    expect(leave).not.toHaveBeenCalled()

    stop()
  })

  it('any input restarts the clock, and answering the prompt keeps the seat', async () => {
    const armed = ref(true)
    const { presence, leave, stop } = withPresence(armed)
    await nextTick()

    goAway()
    // Input just before the deadline: the clock starts over, so the prompt
    // never opens.
    vi.advanceTimersByTime(IDLE_MS - 1)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(IDLE_MS - 1)
    expect(presence.prompting.value).toBe(false)

    // Let it open this time, then answer it.
    vi.advanceTimersByTime(2)
    await nextTick()
    expect(presence.prompting.value).toBe(true)
    presence.confirm()
    vi.advanceTimersByTime(GRACE_MS * 2)
    expect(leave).not.toHaveBeenCalled()
    expect(presence.prompting.value).toBe(false)

    stop()
  })

  it('coming back to the tab answers the prompt without touching the button', async () => {
    const armed = ref(true)
    const { presence, leave, stop } = withPresence(armed)
    await nextTick()

    goAway()
    vi.advanceTimersByTime(IDLE_MS)
    await nextTick()
    expect(presence.prompting.value).toBe(true)

    visibility = 'visible'
    focused = true
    window.dispatchEvent(new Event('focus'))
    expect(presence.prompting.value).toBe(false)

    vi.advanceTimersByTime(GRACE_MS * 2)
    expect(leave).not.toHaveBeenCalled()

    stop()
  })

  it('is disarmed outside the lobby: a match is never interrupted by it', async () => {
    // `armed` is the page's `phase === 'lobby'`. A player typing for twenty
    // minutes produces no pointer events and may well have the tab focused
    // only for the field — this must not reach them at all.
    const armed = ref(false)
    const { presence, leave, stop } = withPresence(armed)
    await nextTick()

    goAway()
    vi.advanceTimersByTime(IDLE_MS * 10)
    await nextTick()
    expect(presence.prompting.value).toBe(false)
    expect(leave).not.toHaveBeenCalled()

    stop()
  })

  it('drops a prompt in flight when the match starts', async () => {
    const armed = ref(true)
    const { presence, leave, stop } = withPresence(armed)
    await nextTick()

    goAway()
    vi.advanceTimersByTime(IDLE_MS)
    await nextTick()
    expect(presence.prompting.value).toBe(true)

    // The countdown lands while the prompt is up: disarming has to cancel it,
    // or a seat would be given up out of a match that had already begun.
    armed.value = false
    await nextTick()
    expect(presence.prompting.value).toBe(false)
    vi.advanceTimersByTime(GRACE_MS * 2)
    expect(leave).not.toHaveBeenCalled()

    stop()
  })
})
