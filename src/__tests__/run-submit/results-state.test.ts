import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { TestResults, type ResultSummary } from '@/features/test/results'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { i18n } from '@app/i18n'
import type { Metrics } from '@typemore/core'

// Real i18n is provided via the plugin below so assertions read the actual copy.

vi.mock('~icons/tabler/player-play', () => ({
  default: { name: 'IconPlayerPlay', template: '<svg />' }
}))

const metrics: Metrics = {
  wpm: 80,
  raw: 85,
  accuracy: 0.97,
  consistency: 72,
  chars: { correct: 200, incorrect: 6, extra: 0, missed: 0 },
  spaces: 40,
  durationSec: 15
}

const summary: ResultSummary = {
  mode: 'time',
  language: 'english',
  difficulty: 'normal',
  amount: 15,
  punctuation: false,
  numbers: false,
  randomCase: false,
  nospace: false
}

// The view reports the outcome of "copy screenshot" through the alert store, so
// it needs a pinia even though nothing here presses that button.
beforeEach(() => setActivePinia(createPinia()))

/**
 * Mounted UNDER a TooltipProvider, because the icon-only actions are tooltipped
 * and reka refuses to build a tooltip without one (the app installs it once, in
 * `App.vue`). The component under test is returned, so every assertion below
 * still addresses it directly.
 */
const mountResults = (saveState: string, extra: Record<string, unknown> = {}) =>
  mount(TooltipProvider, {
    global: { plugins: [i18n] },
    slots: {
      default: () =>
        h(TestResults, {
          metrics,
          timeline: [],
          failReason: null,
          summary,
          score: null,
          activeMods: [],
          // Cast: `saveState` is a string-literal union on the component; the test
          // sweeps every member by name.
          saveState: saveState as never,
          ...extra
        })
    }
  }).findComponent(TestResults)

describe('TestResults — save-state machine', () => {
  it('hides the save region for idle and ineligible runs', () => {
    for (const state of ['idle', 'ineligible']) {
      const wrapper = mountResults(state)
      expect(wrapper.find('[data-testid="results-save"]').exists()).toBe(false)
    }
  })

  it('guest → subtle sign-in link that emits signin', async () => {
    const wrapper = mountResults('guest')
    const link = wrapper.find('[data-testid="save-signin"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('sign in to save')

    await link.trigger('click')
    expect(wrapper.emitted('signin')).toHaveLength(1)
  })

  it('saving → shows the saving status', () => {
    const wrapper = mountResults('saving')
    expect(wrapper.find('[data-testid="save-saving"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-signin"]').exists()).toBe(false)
  })

  it('saved → shows the pending-validation status (never a rank)', () => {
    const wrapper = mountResults('saved')
    const status = wrapper.find('[data-testid="save-saved"]')
    expect(status.exists()).toBe(true)
    expect(status.text().toLowerCase()).toContain('pending')
  })

  it('error (incl. mid-flight failure) → shows a retry button that emits retry', async () => {
    const wrapper = mountResults('error')
    expect(wrapper.find('[data-testid="save-error"]').exists()).toBe(true)
    const retry = wrapper.find('[data-testid="save-retry"]')
    expect(retry.exists()).toBe(true)

    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('mid-flight 401 collapses to the guest hint (same UI as guest)', () => {
    // The flow maps a mid-flight 401 to `guest`; the view renders the sign-in link.
    const wrapper = mountResults('guest')
    expect(wrapper.find('[data-testid="save-signin"]').exists()).toBe(true)
  })
})

/**
 * The same view now serves a MATCH result, where two of the three icon actions
 * lead nowhere: there is no next test to load and no replay screen in a room. So
 * the set is a prop — and its default has to leave the solo screen exactly as it
 * was, which is the first half of what this asserts.
 */
describe('TestResults — action set', () => {
  it('offers all three actions by default', () => {
    const wrapper = mountResults('idle')
    for (const key of ['next', 'replay', 'screenshot']) {
      expect(wrapper.find(`[data-testid="results-${key}"]`).exists()).toBe(true)
    }
  })

  it('renders only the actions it was given, in the canonical order', () => {
    const wrapper = mountResults('idle', { actions: ['screenshot', 'next'] })

    expect(wrapper.find('[data-testid="results-replay"]').exists()).toBe(false)
    const buttons = wrapper.findAll('button[data-testid^="results-"]')
    expect(buttons.map((button) => button.attributes('data-testid'))).toEqual([
      'results-next',
      'results-screenshot'
    ])
  })

  it('drops the action row entirely when no action is offered', () => {
    const wrapper = mountResults('idle', { actions: [] })
    expect(wrapper.find('[data-testid="results-screenshot"]').exists()).toBe(false)
  })
})

describe('results copy discipline — saved ≠ counted', () => {
  it('the saved-pending copy never implies a rank, leaderboard, or counted result', () => {
    const copy = i18n.global.t('results.savedPending')
    expect(copy.toLowerCase()).toContain('pending')
    expect(copy.toLowerCase()).not.toMatch(/rank|leaderboard|counted|placement/)
  })
})
