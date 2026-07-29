/**
 * How the pace bot MOVES — monkeytype's pace-caret loop
 * (`frontend/src/ts/test/pace-caret.ts`).
 *
 * The bot does not sample a clock every frame. It STEPS: one emission per
 * character, each carrying the time it has to reach that character, so the
 * caret animates the whole way and lands exactly on the beat. That is the
 * difference between a caret gliding at a speed and a caret hopping from letter
 * to letter — a per-frame sampler still resolves to a whole character index, so
 * it jumped a full cell and then stood still until the next one came due.
 *
 * What is asserted here is the SCHEDULE (positions, durations, and that no
 * animation frame is ever requested); where the duration lands in the DOM is
 * `ghost-caret-glide.test.ts`.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { usePaceCaret, type PaceCaret } from '@/features/test/pace'

const WORDS = ['ab', 'cd', 'ef'] as const

const h = vi.hoisted(() => ({ config: { paceCaret: 'custom', paceCaretWpm: 60 } }))

vi.mock('@/entities/config', () => ({ useConfigStore: () => ({ config: h.config }) }))
vi.mock('@/entities/auth', () => ({ useAuthStore: () => ({ isAuth: false }) }))
// The profile-backed modes are not under test; `custom` never touches them, but
// the composable still constructs the (disabled) queries.
vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref(undefined) })
}))
vi.mock('@shared/api', () => ({
  profilePBsQueryOptions: () => ({ queryKey: ['pbs'] }),
  profileSummaryQueryOptions: () => ({ queryKey: ['summary'] }),
  runsQueryOptions: () => ({ queryKey: ['runs'] })
}))

/** 60 wpm = 5 chars/word/min = 5 chars/s = 200ms per character. */
const MS_PER_CHAR = 200

let clock = 0
let scope: ReturnType<typeof effectScope> | null = null

const mountPace = (wpm = 60): { pace: PaceCaret; game: { phase: string; words: string[] } } => {
  h.config = { paceCaret: 'custom', paceCaretWpm: wpm }
  const game = ref({ phase: 'idle', words: [...WORDS] })
  scope = effectScope()
  const pace = scope.run(() =>
    usePaceCaret({
      game: game.value as never,
      suspended: () => false
    })
  )!
  return { pace, game: game.value }
}

beforeEach(() => {
  setActivePinia(createPinia())
  clock = 0
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Let `ms` of wall clock pass, firing the timers due inside it. */
const advance = (ms: number): void => {
  clock += ms
  vi.advanceTimersByTime(ms)
}

describe('the pace bot travels between characters instead of jumping', () => {
  it('is placed on the start line, then SENT to every character after it', async () => {
    const { pace, game } = mountPace()
    game.phase = 'running'
    await nextTick()

    // The start line is the one position it is placed at, not sent to.
    expect(pace.caret.value).toEqual({ wordIndex: 0, charIndex: 0, glideMs: 0 })

    // …and it is sent onward immediately, not after a character's wait: the
    // caret is already travelling toward letter 1 while letter 1 is still due.
    advance(0)
    expect(pace.caret.value).toEqual({ wordIndex: 0, charIndex: 1, glideMs: MS_PER_CHAR })

    advance(MS_PER_CHAR)
    // 'ab' costs three characters: a, b, and its committing space.
    expect(pace.caret.value).toEqual({ wordIndex: 0, charIndex: 2, glideMs: MS_PER_CHAR })

    advance(MS_PER_CHAR)
    expect(pace.caret.value).toEqual({ wordIndex: 1, charIndex: 0, glideMs: MS_PER_CHAR })
  })

  it('gives every step the whole interval — the caret is never left standing', async () => {
    const { pace, game } = mountPace()
    game.phase = 'running'
    await nextTick()

    advance(0)
    for (let i = 0; i < 5; i++) {
      // A glide SHORTER than the interval would be the old behaviour: arrive
      // early, then wait. Equal to it means the caret is always in motion.
      expect(pace.caret.value?.glideMs).toBe(MS_PER_CHAR)
      advance(MS_PER_CHAR)
    }
  })

  it('moves once per character, not once per frame', async () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame')
    const { pace, game } = mountPace()
    game.phase = 'running'
    await nextTick()

    const seen: unknown[] = []
    const record = (): void => {
      if (seen[seen.length - 1] !== pace.caret.value) seen.push(pace.caret.value)
    }
    record()
    // Four characters' worth of time, sampled far more often than that.
    for (let i = 0; i < 40; i++) {
      advance(MS_PER_CHAR / 10)
      record()
    }

    // Six positions: the start line, the aim it is sent on immediately, and one
    // per character due inside the window. Anything more would be a write the
    // caret did not need.
    expect(seen).toHaveLength(6)
    // …and the page was never woken for a frame to compute them.
    expect(raf).not.toHaveBeenCalled()
  })

  it('scales the interval with the target speed', async () => {
    const { pace, game } = mountPace(120) // twice as fast = 100ms per character
    game.phase = 'running'
    await nextTick()

    advance(0)
    expect(pace.caret.value).toEqual({ wordIndex: 0, charIndex: 1, glideMs: 100 })
  })

  it('keeps its schedule anchored to the starting gun, not to the last callback', async () => {
    const { pace, game } = mountPace()
    game.phase = 'running'
    await nextTick()

    advance(0)
    expect(pace.caret.value?.glideMs).toBe(MS_PER_CHAR)

    // A callback that fires 60ms late: the NEXT glide is shortened by exactly
    // that much, so the bot is back on schedule instead of drifting a little
    // further behind on every character for the rest of the run.
    advance(MS_PER_CHAR + 60)
    expect(pace.caret.value?.charIndex).toBe(2)
    expect(pace.caret.value?.glideMs).toBe(MS_PER_CHAR - 60)
  })

  it('leaves the track when it runs out of text, and on finish', async () => {
    const { pace, game } = mountPace()
    game.phase = 'running'
    await nextTick()

    // 'ab cd ef' runs out after 8 characters.
    advance(0)
    for (let i = 0; i < 10; i++) advance(MS_PER_CHAR)
    expect(pace.caret.value).toBeNull()

    // …and no timer is left running behind it.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops dead when the run finishes mid-track', async () => {
    const { pace, game } = mountPace()
    game.phase = 'running'
    await nextTick()
    advance(0)
    advance(MS_PER_CHAR)
    expect(pace.caret.value).not.toBeNull()

    game.phase = 'finished'
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
  })
})
