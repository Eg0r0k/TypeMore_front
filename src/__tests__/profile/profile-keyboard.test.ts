import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ProfileKeyboard as KeyboardData } from '@shared/api'
import { ProfileKeyboard } from '@/features/profile'
import { KEYBOARD_LAYOUT_PRESETS, layoutByName } from '@/features/profile/model/layouts'
import en from '@/app/i18n/locales/en'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const global = { plugins: [i18n] }

/**
 * The keyboard heatmap's honesty rules (C9): mapping fidelity from a fixture
 * profile to expected colours, the metric toggle actually changing the map,
 * and low-data neutrality — a key under the observation minimum renders
 * neutral, never a colour faked from three presses. Plus the layout presets
 * themselves: same physical board, latin only.
 */

// KeyA: clean and fast. KeyS: error-prone but slow-metric-poor. KeyD: three
// presses — an anecdote.
const keyboard: KeyboardData = {
  layout: 'qwerty',
  keys: [
    { keyId: 'KeyA', count: 500, errorRate: 0.01, avgIntervalMs: 120, intervals: 480 },
    { keyId: 'KeyS', count: 400, errorRate: 0.2, avgIntervalMs: 260, intervals: 350 },
    { keyId: 'KeyD', count: 3, errorRate: 1, avgIntervalMs: 900, intervals: 2 }
  ]
}

const keyTone = (wrapper: ReturnType<typeof mount>, id: string): string | undefined =>
  wrapper.find(`[data-testid="profile-kbd-key-${id}"]`).attributes('data-tone')

// The metric colour is painted straight on the keycap element.
const keyFill = (wrapper: ReturnType<typeof mount>, id: string): string =>
  wrapper.find(`[data-testid="profile-kbd-key-${id}"]`).attributes('style') ?? ''

describe('profile keyboard heatmap', () => {
  it('maps the fixture onto expected colours: best key main-most, worst key error-most', () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard }, global })
    // Accuracy metric (default): KeyA is the best scored key (0% badness →
    // pure main colour), KeyS the worst (100% → error-most mix).
    expect(keyTone(wrapper, 'KeyA')).toBe('scored')
    expect(keyTone(wrapper, 'KeyS')).toBe('scored')
    expect(keyFill(wrapper, 'KeyA')).toContain('--error-color) 0%')
    expect(keyFill(wrapper, 'KeyS')).toContain('--error-color) 100%')
  })

  it('low-data keys render NEUTRAL — never a colour faked from three presses', () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard }, global })
    expect(keyTone(wrapper, 'KeyD')).toBe('low-data')
    // The neutral tone carries no metric colour: no color-mix fill on the cap.
    expect(keyFill(wrapper, 'KeyD')).not.toContain('color-mix')
  })

  it('the metric toggle recolours the map (speed reads intervals, not errors)', async () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard }, global })
    await wrapper.find('[data-testid="profile-kbd-metric-speed"]').trigger('click')
    // Under speed, KeyA (120 ms) is best and KeyS (260 ms) worst — the fills
    // move even though the errors did not.
    expect(keyFill(wrapper, 'KeyA')).toContain('--error-color) 0%')
    expect(keyFill(wrapper, 'KeyS')).toContain('--error-color) 100%')
  })

  it('relabels the SAME physical board when the layout changes', async () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard }, global })
    // qwerty default (the response's layout): the KeyS cap reads 's'.
    expect(wrapper.find('[data-testid="profile-kbd-key-KeyS"]').text()).toBe('s')
    await wrapper.find('[data-testid="profile-kbd-layout-dvorak"]').trigger('click')
    expect(wrapper.find('[data-testid="profile-kbd-key-KeyS"]').text()).toBe('o')
    // Relabelling is not recolouring: the key's own numbers did not change.
    expect(keyTone(wrapper, 'KeyS')).toBe('scored')
  })

  it('ships no cyrillic layout, and an unknown one falls back to QWERTY', () => {
    expect(KEYBOARD_LAYOUT_PRESETS.some((preset) => preset.name === 'jcuken')).toBe(false)
    expect(layoutByName('jcuken').name).toBe('qwerty')

    const wrapper = mount(ProfileKeyboard, {
      props: { keyboard: { ...keyboard, layout: 'jcuken' } },
      global
    })
    expect(wrapper.find('[data-testid="profile-kbd-layout-jcuken"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-kbd-key-KeyS"]').text()).toBe('s')
  })

  it('every preset draws the same physical keys — a layout is only a relabelling', () => {
    const idsOf = (name: string): string =>
      layoutByName(name)
        .rows.flatMap((row) => row.map((key) => key.id))
        .join(',')
    const qwerty = idsOf('qwerty')
    for (const preset of KEYBOARD_LAYOUT_PRESETS) expect(idsOf(preset.name)).toBe(qwerty)
    // …and each cap carries exactly one glyph.
    for (const preset of KEYBOARD_LAYOUT_PRESETS) {
      for (const row of preset.rows) {
        for (const key of row) expect(key.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('renders the honest empty note for a fresh account', () => {
    const wrapper = mount(ProfileKeyboard, {
      props: { keyboard: { layout: 'qwerty', keys: [] } },
      global
    })
    expect(wrapper.find('[data-testid="profile-keyboard-empty"]').exists()).toBe(true)
  })
})
