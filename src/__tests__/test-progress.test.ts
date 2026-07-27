import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TestProgress } from '@/features/test/progress'

const mountBar = (props: { running: boolean; durationMs?: number; value?: number }) =>
  mount(TestProgress, { props })
const fillStyle = (w: VueWrapper): CSSStyleDeclaration =>
  (w.get('[data-slot="time-progress-indicator"]').element as HTMLElement).style

describe('TestProgress — timed run', () => {
  it('renders a full, un-transitioning bar when idle', () => {
    const s = fillStyle(mountBar({ running: false, durationMs: 10_000 }))
    expect(s.transform).toBe('scaleX(1)')
    expect(s.transition).toBe('none')
  })

  it('drains to empty with one full-length linear transform transition (no rAF)', async () => {
    const w = mountBar({ running: false, durationMs: 10_000 })
    await w.setProps({ running: true })
    await nextTick()
    const s = fillStyle(w)
    expect(s.transform).toBe('scaleX(0)')
    // Single compositor transition spanning the whole run, constant velocity.
    expect(s.transition).toContain('transform')
    expect(s.transition).toContain('10000ms')
    expect(s.transition).toContain('linear')
  })

  it('reflects the run duration in the transition length', async () => {
    const w = mountBar({ running: false, durationMs: 30_000 })
    await w.setProps({ running: true })
    await nextTick()
    expect(fillStyle(w).transition).toContain('30000ms')
  })

  it('snaps back to full without a transition when the run ends', async () => {
    const w = mountBar({ running: false, durationMs: 10_000 })
    await w.setProps({ running: true })
    await nextTick()
    await w.setProps({ running: false })
    await nextTick()
    const s = fillStyle(w)
    expect(s.transform).toBe('scaleX(1)')
    expect(s.transition).toBe('none')
  })

  it('pins the bar full-width to the top of the viewport', () => {
    const cls = mountBar({ running: false, durationMs: 10_000 })
      .get('[data-slot="time-progress"]')
      .classes()
    expect(cls).toContain('fixed')
    expect(cls).toContain('inset-x-0')
    expect(cls).toContain('top-0')
    expect(cls).toContain('z-50')
  })
})

/**
 * The counted arm. A word count cannot be animated in one pass — the run's pace
 * is unknown and the progress arrives one committed word at a time — so it fills
 * per step, in the opposite direction to the timed drain: a timed run shows what
 * is LEFT, a counted one shows what is DONE.
 */
describe('TestProgress — counted run', () => {
  it('waits empty rather than full', () => {
    const s = fillStyle(mountBar({ running: false, value: 0 }))
    expect(s.transform).toBe('scaleX(0)')
    expect(s.transition).toBe('none')
  })

  it('fills to the share completed, one short transition per step', async () => {
    const w = mountBar({ running: false, value: 0 })
    await w.setProps({ running: true, value: 0.25 })
    await nextTick()
    expect(fillStyle(w).transform).toBe('scaleX(0.25)')
    expect(fillStyle(w).transition).toContain('transform')
    // Not the run's length: this bar has no idea how long the run will take.
    expect(fillStyle(w).transition).not.toContain('10000ms')

    await w.setProps({ value: 0.5 })
    await nextTick()
    expect(fillStyle(w).transform).toBe('scaleX(0.5)')
  })

  it('clamps a value outside 0…1', async () => {
    const w = mountBar({ running: true, value: 0 })
    await w.setProps({ value: 1.4 })
    await nextTick()
    expect(fillStyle(w).transform).toBe('scaleX(1)')
  })
})
