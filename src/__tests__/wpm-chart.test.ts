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

// Two cumulative series and one instantaneous one. `raw` is deliberately
// close to `wpm` and `burst` deliberately far from both: that IS the shape of
// real data — the cumulative pair converge on their own summary figures while
// the per-second line swings around them — and a fixture where all three
// tracked each other would let a chart that drew the same series twice pass.
const timeline: TimelinePoint[] = [
  { second: 1, wpm: 40, raw: 46, burst: 52, errors: 0 },
  { second: 2, wpm: 61, raw: 66, burst: 70, errors: 2 },
  { second: 3, wpm: 58, raw: 63, burst: 44, errors: 0 },
  { second: 4, wpm: 66, raw: 69, burst: 71, errors: 1 }
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
    expect(wrapper.find('.wpm-chart__line--burst').attributes('d')).toMatch(/^M [\d.]+ [\d.]+ C /)
    expect(wrapper.findAll('.wpm-chart__errors > g')).toHaveLength(2)
  })

  // WHY THIS TEST EXISTS, and why it changed. It was written when the chart
  // drew TWO series and the per-second one was labelled `raw` — a label naming
  // a figure in the header that the line could never touch, which players read
  // as a bug. It asserted `burst` was in the legend and `raw` was NOT, because
  // at that moment a `raw` label would have been the bug coming back.
  //
  // `raw` is back, and it now names the cumulative line the core release added:
  // the one that DOES land on the header's figure. So the assertion inverts —
  // both labels must be present, and the tooltip must distinguish them — which
  // is the same contract stated against a chart that finally has both numbers.
  it('names all three series, and says which one is not an average', async () => {
    const wrapper = mountChart()

    const legend = wrapper.get('.wpm-chart__legend').text()
    expect(legend).toContain('wpm')
    expect(legend).toContain('raw')
    expect(legend).toContain('burst')

    await wrapper.get('svg').trigger('pointermove', { clientX: 10 })
    const tooltip = wrapper.get('.wpm-chart__tooltip')
    expect(tooltip.text()).toContain('raw')
    expect(tooltip.text()).toContain('burst')
    expect(tooltip.text()).toContain('peak speed for that one second')
  })

  it('reads a different field for each line, so no series is drawn twice', () => {
    const wrapper = mountChart()
    const d = (klass: string) => wrapper.get(`.wpm-chart__line--${klass}`).attributes('d')
    expect(d('wpm')).not.toBe(d('raw'))
    expect(d('raw')).not.toBe(d('burst'))
    expect(d('wpm')).not.toBe(d('burst'))
  })

  it('keeps every colour in CSS, never in the markup', () => {
    const html = mountChart().html()

    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(html).not.toMatch(/(stroke|fill)="(?!none)[a-z]/i)
  })

  it('renders a flat curve inside the plot for a single point', () => {
    const wrapper = mountChart([{ second: 1, wpm: 30, raw: 32, burst: 30, errors: 0 }])

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

  // The FILL follows the per-second line, which is now called `burst`. It is
  // the terrain the two cumulative lines are read against; filling one of those
  // instead would shade the area under a running average, which means nothing.
  it('fills the burst series down to the axis, and only when there is an area', () => {
    const area = mountChart().find('.wpm-chart__area--burst').attributes('d')

    // The curve, then down to the baseline, back along it, closed.
    expect(area).toMatch(/^M [\d.]+ [\d.]+ C .* L [\d.]+ \d+ L [\d.]+ \d+ Z$/)

    // One point is a dot, not a shape: an area there would be an invisible
    // zero-width sliver, so the element stays out of the DOM.
    const single = mountChart([{ second: 1, wpm: 30, raw: 32, burst: 30, errors: 0 }])
    expect(single.find('.wpm-chart__area--burst').exists()).toBe(false)
  })
})
