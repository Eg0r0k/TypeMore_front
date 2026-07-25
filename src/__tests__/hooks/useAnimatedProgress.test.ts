import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { easeOutQuad, useAnimatedProgress } from '@/shared/ui/progress-fill'

// Shared object standing in for useMediaQuery's ref; the composable only reads
// `.value`, so flipping this before a value change simulates prefers-reduced-motion.
const { reduced } = vi.hoisted(() => ({ reduced: { value: false } }))
vi.mock('@vueuse/core', () => ({ useMediaQuery: () => reduced }))

// Manual rAF + clock harness so frame stepping is fully deterministic.
let clock = 0
let queue: Array<{ id: number; cb: FrameRequestCallback }> = []
let nextId = 1
const cancelled: number[] = []

function step(now: number): void {
  clock = now
  const due = queue
  queue = []
  for (const { cb } of due) cb(now)
}

const scale = (el: HTMLElement): number => parseFloat(el.style.getPropertyValue('--progress-scale'))

describe('useAnimatedProgress', () => {
  let scope: EffectScope
  let el: HTMLElement

  beforeEach(() => {
    clock = 0
    queue = []
    nextId = 1
    cancelled.length = 0
    reduced.value = false
    el = document.createElement('div')
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextId++
      queue.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id)
      queue = queue.filter((r) => r.id !== id)
    })
  })

  afterEach(() => {
    scope?.stop()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const mount = (value = ref(0), opts: { duration?: number; immediate?: boolean } = {}) => {
    scope = effectScope()
    scope.run(() =>
      useAnimatedProgress(
        () => el,
        () => value.value,
        {
          duration: () => opts.duration ?? 100,
          immediate: () => opts.immediate ?? false
        }
      )
    )
    return value
  }

  it('paints the initial value instantly, without a frame', () => {
    mount(ref(0.4))
    expect(scale(el)).toBe(0.4)
    expect(queue).toHaveLength(0) // no loop scheduled for the first paint
  })

  it('interpolates a forward change over frames, then self-stops at the target', async () => {
    const value = mount(ref(0)) // painted 0
    value.value = 1
    await nextTick()
    expect(scale(el)).toBe(0) // retarget scheduled, nothing painted yet
    expect(queue.length).toBeGreaterThan(0)

    step(50) // half the 100ms duration
    expect(scale(el)).toBeCloseTo(easeOutQuad(0.5), 5) // eased, not linear
    expect(queue.length).toBeGreaterThan(0) // still running

    step(100)
    expect(scale(el)).toBe(1)
    expect(queue).toHaveLength(0) // loop cancelled itself at arrival
  })

  it('retargets from the current painted position mid-flight, without a jump', async () => {
    const value = mount(ref(0))
    value.value = 1
    await nextTick()
    step(50)
    const mid = scale(el) // ~0.75
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)

    value.value = 0.9 // new forward target while animating
    await nextTick()
    expect(scale(el)).toBe(mid) // anchored at current position, no snap

    step(60) // same tween clock (startTs=0), now 60ms in
    expect(scale(el)).toBeGreaterThanOrEqual(mid)
    expect(scale(el)).toBeLessThanOrEqual(0.9)
    step(150)
    expect(scale(el)).toBe(0.9)
    expect(queue).toHaveLength(0)
  })

  it('retargets an in-flight tween without cancelling its rAF (no starvation)', async () => {
    const value = mount(ref(0))
    value.value = 1
    await nextTick()
    const cancelsBefore = cancelled.length
    const idBefore = queue[0]!.id
    // A fresh value arrives mid-flight, as a competing rAF source would deliver it
    // frame by frame. The loop must be preserved, not stopped and rescheduled —
    // otherwise this watcher (flushed between the two loops' frame callbacks)
    // cancels the tick before it can paint, freezing the bar until updates stop.
    value.value = 0.8
    await nextTick()
    expect(cancelled.length).toBe(cancelsBefore) // in-flight rAF not cancelled
    expect(queue).toHaveLength(1)
    expect(queue[0]!.id).toBe(idBefore) // same loop, not rescheduled
    // The single loop keeps painting toward the moved goalpost.
    step(50)
    expect(scale(el)).toBeGreaterThan(0)
    expect(scale(el)).toBeLessThanOrEqual(0.8)
  })

  it('sets backward jumps instantly (replay scrub)', async () => {
    const value = mount(ref(0))
    value.value = 1
    await nextTick()
    step(100)
    expect(scale(el)).toBe(1)

    value.value = 0.2
    await nextTick()
    expect(scale(el)).toBe(0.2) // instant, no interpolation
    expect(queue).toHaveLength(0)
  })

  it('sets forward changes instantly when immediate is true', async () => {
    const value = mount(ref(0), { immediate: true })
    value.value = 0.8
    await nextTick()
    expect(scale(el)).toBe(0.8)
    expect(queue).toHaveLength(0)
  })

  it('sets forward changes instantly under prefers-reduced-motion', async () => {
    reduced.value = true
    const value = mount(ref(0))
    value.value = 0.7
    await nextTick()
    expect(scale(el)).toBe(0.7)
    expect(queue).toHaveLength(0)
  })

  it('clamps out-of-range values to 0..1', async () => {
    const value = mount(ref(2))
    expect(scale(el)).toBe(1)
    value.value = -1
    await nextTick()
    expect(scale(el)).toBe(0)
  })

  it('cancels a pending frame on scope disposal', async () => {
    const value = mount(ref(0))
    value.value = 1
    await nextTick()
    expect(queue.length).toBeGreaterThan(0)
    scope.stop()
    expect(cancelled.length).toBeGreaterThan(0)
    expect(queue).toHaveLength(0)
  })
})
