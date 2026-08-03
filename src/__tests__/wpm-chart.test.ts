/**
 * The results chart is SVG on purpose: every colour comes from a theme custom
 * property through CSS, so switching the theme repaints it with no redraw. These
 * tests pin the geometry contract (a path per series, a marker per error bucket)
 * and that no colour is baked into the markup.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { TimelinePoint } from '@typemore/core'
import en from '@/app/i18n/locales/en'
import WpmChart from '@/features/test/results/wpm-chart.vue'

const timeline: TimelinePoint[] = [
  { second: 1, wpm: 40, raw: 52, errors: 0 },
  { second: 2, wpm: 61, raw: 70, errors: 2 },
  { second: 3, wpm: 58, raw: 44, errors: 0 },
  { second: 4, wpm: 66, raw: 71, errors: 1 }
]

// The chart's series labels are bare unit names on purpose and stay
// untranslated; the one PROSE line it carries (what `burst` measures) is not,
// so the component needs a real locale rather than a stub.
const mountChart = (points: TimelinePoint[] = timeline) =>
  mount(WpmChart, {
    props: { timeline: points },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] }
  })

describe('WpmChart', () => {
  it('draws one curve per series and one marker per error bucket', () => {
    const wrapper = mountChart()

    expect(wrapper.find('.wpm-chart__line--wpm').attributes('d')).toMatch(/^M [\d.]+ [\d.]+ C /)
    expect(wrapper.find('.wpm-chart__line--raw').attributes('d')).toMatch(/^M [\d.]+ [\d.]+ C /)
    expect(wrapper.findAll('.wpm-chart__errors > g')).toHaveLength(2)
  })

  // The second series is the speed of ONE second, which is not what the
  // summary's `raw` is (the whole run over its own duration). Labelling both
  // `raw` had players reading the gap between them as a bug, so the label says
  // what the line computes — monkeytype names the identical computation
  // `burst` — and the tooltip carries one line so the figure is not mistaken
  // for an average. The FIELD is still `raw`: renaming it is a core change,
  // queued with the cumulative-raw series for the next bundle release.
  it('names the per-second series burst, and says what it measures', async () => {
    const wrapper = mountChart()

    expect(wrapper.get('.wpm-chart__legend').text()).toContain('burst')
    expect(wrapper.get('.wpm-chart__legend').text()).not.toContain('raw')

    await wrapper.get('svg').trigger('pointermove', { clientX: 10 })
    const tooltip = wrapper.get('.wpm-chart__tooltip')
    expect(tooltip.text()).toContain('burst')
    expect(tooltip.text()).toContain('peak speed for that one second')
  })

  it('keeps every colour in CSS, never in the markup', () => {
    const html = mountChart().html()

    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(html).not.toMatch(/(stroke|fill)="(?!none)[a-z]/i)
  })

  it('renders a flat curve inside the plot for a single point', () => {
    const wrapper = mountChart([{ second: 1, wpm: 30, raw: 30, errors: 0 }])

    const d = wrapper.find('.wpm-chart__line--wpm').attributes('d')
    expect(d).toMatch(/^M [\d.]+ [\d.]+$/)
    expect(wrapper.findAll('.wpm-chart__errors > g')).toHaveLength(0)
  })

  it('reports the nearest point on hover', async () => {
    const wrapper = mountChart()
    const svg = wrapper.get('.wpm-chart__svg')

    // happy-dom reports a zero-size box, so clientX 0 resolves to the first point.
    await svg.trigger('pointermove', { clientX: 0 })
    expect(wrapper.get('.wpm-chart__tooltip').text()).toContain('wpm 40')

    await svg.trigger('pointerleave')
    expect(wrapper.find('.wpm-chart__tooltip').exists()).toBe(false)
  })

  it('fills the raw series down to the axis, and only when there is an area', () => {
    const area = mountChart().find('.wpm-chart__area--raw').attributes('d')

    // The curve, then down to the baseline, back along it, closed.
    expect(area).toMatch(/^M [\d.]+ [\d.]+ C .* L [\d.]+ \d+ L [\d.]+ \d+ Z$/)

    // One point is a dot, not a shape: an area there would be an invisible
    // zero-width sliver, so the element stays out of the DOM.
    const single = mountChart([{ second: 1, wpm: 30, raw: 30, errors: 0 }])
    expect(single.find('.wpm-chart__area--raw').exists()).toBe(false)
  })
})
