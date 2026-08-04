import { onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue'

/**
 * "Are you still there?" for a lobby seat.
 *
 * THE PROBLEM THIS SOLVES, and why it lives on the client. A seat held by an
 * open tab nobody is looking at keeps a room alive forever: the room is not
 * empty, so the registry's own cleanup never fires, and the room sits in the
 * public list for other players to walk into. The server cannot tell that seat
 * apart from a host legitimately waiting for someone to join — waiting produces
 * no traffic by definition, there is nobody to chat with and nothing to ready
 * up. Only the browser knows whether a human is there, so the check belongs
 * here and the server keeps no new predicate at all.
 *
 * THE TWO CONDITIONS ARE AND-ED, deliberately. Idle alone is a host watching
 * the player list, waiting; hidden alone is somebody who alt-tabbed for a
 * moment. Both together — nobody has touched this tab for a quarter of an hour
 * AND it is not even on screen — is the state that means the person left.
 *
 * WHAT IT DOES WHEN IT FIRES is the ordinary leave, through the same call the
 * leave button makes. No new wire message, no server-side idea of "presence":
 * the seat is given up exactly as a person giving it up would, and the room
 * empties and is reaped by the machinery that already exists.
 */
export interface LobbyPresenceOptions {
  /** True only while a lobby seat is held — the check runs nowhere else. */
  readonly armed: Ref<boolean>
  /** Give the seat up. The room's own `leaveRoom`, not a new command. */
  readonly leave: () => void
  /** Idle time before the prompt, ms. */
  readonly idleMs?: number
  /** How long the prompt waits for an answer, ms. */
  readonly graceMs?: number
}

export interface LobbyPresence {
  /** True while the prompt is up. */
  readonly prompting: Readonly<Ref<boolean>>
  /** Whole seconds left before the seat is given up. */
  readonly secondsLeft: Readonly<Ref<number>>
  /** "Yes, I am here" — dismisses the prompt and restarts the idle clock. */
  readonly confirm: () => void
}

/** A quarter of an hour: long enough that a real wait never reaches it. */
const DEFAULT_IDLE_MS = 15 * 60 * 1000
/** A minute to answer — one glance at the tab is enough to keep the seat. */
const DEFAULT_GRACE_MS = 60 * 1000

/** The events that count as "somebody is here". */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'] as const

export function useLobbyPresence(options: LobbyPresenceOptions): LobbyPresence {
  const { armed, leave } = options
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS

  const prompting = shallowRef(false)
  const secondsLeft = shallowRef(0)

  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let graceTimer: ReturnType<typeof setInterval> | undefined
  let deadline = 0

  const stopGrace = (): void => {
    clearInterval(graceTimer)
    graceTimer = undefined
    prompting.value = false
    secondsLeft.value = 0
  }

  const stopAll = (): void => {
    clearTimeout(idleTimer)
    idleTimer = undefined
    stopGrace()
  }

  /**
   * Hidden OR unfocused, either one. A tab can be visible on a second monitor
   * while the person works in another window, and that is still "not here" for
   * the purposes of holding a seat.
   */
  const away = (): boolean =>
    typeof document !== 'undefined' && (document.visibilityState === 'hidden' || !document.hasFocus())

  const startIdleClock = (): void => {
    clearTimeout(idleTimer)
    if (!armed.value) return
    idleTimer = setTimeout(() => {
      // The AND: an idle tab somebody is looking at keeps its seat, and the
      // clock simply starts again — a host watching an empty player list must
      // never be asked to prove they exist.
      if (!away()) {
        startIdleClock()
        return
      }
      openPrompt()
    }, idleMs)
  }

  const openPrompt = (): void => {
    if (!armed.value || prompting.value) return
    prompting.value = true
    deadline = Date.now() + graceMs
    secondsLeft.value = Math.ceil(graceMs / 1000)
    graceTimer = setInterval(() => {
      const remaining = deadline - Date.now()
      if (remaining > 0) {
        secondsLeft.value = Math.ceil(remaining / 1000)
        return
      }
      // Nobody answered. Give the seat up the ordinary way.
      stopAll()
      leave()
    }, 250)
  }

  /**
   * Any sign of life restarts the clock — including while the prompt is up, so
   * coming back to the tab keeps the seat without having to find the button.
   */
  const onActivity = (): void => {
    if (!armed.value) return
    stopGrace()
    startIdleClock()
  }

  const confirm = (): void => {
    stopGrace()
    startIdleClock()
  }

  if (typeof window !== 'undefined') {
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }
    // Returning to the tab is activity in its own right: it is the clearest
    // possible statement that somebody is here, with no keystroke needed.
    window.addEventListener('focus', onActivity)
    document.addEventListener('visibilitychange', onActivity)

    onScopeDispose(() => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity)
      window.removeEventListener('focus', onActivity)
      document.removeEventListener('visibilitychange', onActivity)
      stopAll()
    })
  }

  // Arming follows the phase: a match disarms everything, so a player typing
  // for twenty minutes is never asked whether they are still there, and a seat
  // in a running match is never given up by this.
  watch(
    armed,
    (isArmed) => (isArmed ? startIdleClock() : stopAll()),
    { immediate: true }
  )

  return { prompting: readonly(prompting), secondsLeft: readonly(secondsLeft), confirm }
}
