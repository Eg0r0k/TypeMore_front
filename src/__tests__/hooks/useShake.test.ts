/**
 * `useShake` — the reusable "the way out is HERE" nudge. Two things matter and
 * neither is the CSS: that a second shake RESTARTS the animation (a class that
 * never leaves the element would replay nothing), and that reduced motion is a
 * hard no-op.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, ref } from 'vue'

const reduced = ref(false)
vi.mock('@vueuse/core', () => ({ useMediaQuery: () => reduced }))

import { useShake } from '@/shared/lib/hooks/useShake'

/** rAF driven by hand: the hook uses one frame to drop the class. */
let frames: FrameRequestCallback[] = []
const flushFrame = async (): Promise<void> => {
  const pending = frames
  frames = []
  for (const frame of pending) frame(0)
  await nextTick()
}

beforeEach(() => {
  reduced.value = false
  frames = []
  // Fake timers FIRST: vitest replaces requestAnimationFrame too, so stubbing
  // before this call would be overwritten and the frames never collected.
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useShake', () => {
  it('raises the flag on the next frame and drops it when the animation ends', async () => {
    const { shaking, shake } = useShake(400)
    expect(shaking.value).toBe(false)

    shake()
    expect(shaking.value).toBe(false) // not until the frame lands
    await flushFrame()
    expect(shaking.value).toBe(true)

    vi.advanceTimersByTime(399)
    expect(shaking.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(shaking.value).toBe(false)
  })

  it('restarts a shake already in flight: the flag goes off, then on again', async () => {
    const { shaking, shake } = useShake(400)
    shake()
    await flushFrame()
    expect(shaking.value).toBe(true)

    // Second attempt mid-animation — the whole point of the hook.
    shake()
    expect(shaking.value).toBe(false)
    await flushFrame()
    expect(shaking.value).toBe(true)

    // The FIRST timer must not cut the second shake short.
    vi.advanceTimersByTime(399)
    expect(shaking.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(shaking.value).toBe(false)
  })

  it('does nothing at all under prefers-reduced-motion', async () => {
    reduced.value = true
    const { shaking, shake } = useShake()

    shake()
    await flushFrame()
    vi.advanceTimersByTime(1000)

    expect(shaking.value).toBe(false)
    expect(frames).toHaveLength(0)
  })
})
