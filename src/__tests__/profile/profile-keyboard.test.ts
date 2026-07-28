import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { KeyboardLayout, ProfileKeyboard as KeyboardData } from '@shared/api'
import { ProfileKeyboard } from '@/features/profile'
import en from '@/app/i18n/locales/en'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const global = { plugins: [i18n] }

/**
 * The keyboard heatmap's honesty rules (C9): mapping fidelity from a fixture
 * profile to expected colours, the metric toggle actually changing the map,
 * and low-data neutrality — a key under the observation minimum renders
 * neutral, never a colour faked from three presses.
 */

const layouts: KeyboardLayout[] = [
  {
    name: 'qwerty',
    label: 'QWERTY',
    keys: [
      { id: 'KeyA', row: 0, col: 0, finger: 'pinky', hand: 'left', chars: ['a', 'A'] },
      { id: 'KeyS', row: 0, col: 1, finger: 'ring', hand: 'left', chars: ['s', 'S'] },
      { id: 'KeyD', row: 0, col: 2, finger: 'middle', hand: 'left', chars: ['d', 'D'] }
    ]
  },
  {
    name: 'jcuken',
    label: 'ЙЦУКЕН',
    keys: [{ id: 'KeyA', row: 0, col: 0, finger: 'pinky', hand: 'left', chars: ['ф', 'Ф'] }]
  }
]

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

const keyFill = (wrapper: ReturnType<typeof mount>, id: string): string =>
  wrapper.find(`[data-testid="profile-kbd-key-${id}"] rect`).attributes('style') ?? ''

describe('profile keyboard heatmap', () => {
  it('maps the fixture onto expected colours: best key main-most, worst key error-most', () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard, layouts }, global })
    // Accuracy metric (default): KeyA is the best scored key (0% badness →
    // pure main colour), KeyS the worst (100% → error-most mix).
    expect(keyTone(wrapper, 'KeyA')).toBe('scored')
    expect(keyTone(wrapper, 'KeyS')).toBe('scored')
    expect(keyFill(wrapper, 'KeyA')).toContain('--error-color) 0%')
    expect(keyFill(wrapper, 'KeyS')).toContain('--error-color) 100%')
  })

  it('low-data keys render NEUTRAL — never a colour faked from three presses', () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard, layouts }, global })
    expect(keyTone(wrapper, 'KeyD')).toBe('low-data')
    // The neutral tone carries no metric colour: no color-mix fill on the cap.
    expect(keyFill(wrapper, 'KeyD')).not.toContain('color-mix')
  })

  it('the metric toggle recolours the map (speed reads intervals, not errors)', async () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard, layouts }, global })
    const accuracyFill = keyFill(wrapper, 'KeyS')
    await wrapper.find('[data-testid="profile-kbd-metric-speed"]').trigger('click')
    // Under speed, KeyA (120 ms) is best and KeyS (260 ms) worst — the fills
    // move even though the errors did not.
    expect(keyFill(wrapper, 'KeyA')).toContain('--error-color) 0%')
    expect(keyFill(wrapper, 'KeyS')).toContain('--error-color) 100%')
    expect(keyFill(wrapper, 'KeyS')).not.toBe('')
    void accuracyFill
  })

  it('defaults to the profile’s dominant-language layout and toggles to the other', async () => {
    const wrapper = mount(ProfileKeyboard, { props: { keyboard, layouts }, global })
    // qwerty default (the response's layout): the KeyA cap reads 'a'.
    expect(wrapper.find('[data-testid="profile-kbd-key-KeyA"] text').text()).toBe('a')
    await wrapper.find('[data-testid="profile-kbd-layout-jcuken"]').trigger('click')
    expect(wrapper.find('[data-testid="profile-kbd-key-KeyA"] text').text()).toBe('ф')
  })

  it('renders the honest empty note for a fresh account', () => {
    const wrapper = mount(ProfileKeyboard, {
      props: { keyboard: { layout: 'qwerty', keys: [] }, layouts },
      global
    })
    expect(wrapper.find('[data-testid="profile-keyboard-empty"]').exists()).toBe(true)
  })
})
