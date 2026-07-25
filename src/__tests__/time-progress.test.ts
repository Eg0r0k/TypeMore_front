import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TimeProgress } from '@/features/test/time-progress'

const mountBar = (props: { running: boolean; durationMs: number; class?: string }) =>
  mount(TimeProgress, { props })
const fillStyle = (w: VueWrapper): CSSStyleDeclaration =>
  (w.get('[data-slot="time-progress-indicator"]').element as HTMLElement).style

describe('TimeProgress', () => {
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
