/**
 * The elimination panel: where the local player used to learn why their own run
 * stopped while the match kept going — the wire never says more than "finished".
 * Besides the freemod rules it also covers the RELOAD forfeit: a mid-match page
 * reload kills the event log, the seq counter and the t=0 anchor, so the run
 * cannot be resumed and the client forfeits instead of hanging every other
 * player until the server's deadline.
 *
 * SUPERSEDED, and kept only until the match surface drops it. `/room` no longer
 * routes the `eliminated` phase here: an eliminated seat gets the RESULTS screen
 * (its own finished run, drawn exactly as a solo one, over a table that keeps
 * updating while the rest race), and that screen carries both facts this panel
 * carried — the rule that ended the run and the count still racing. See
 * `results.test.ts` ("live (eliminated, match still running)") and
 * `pages/room/ui.vue`. The panel itself is untouched, so what it renders when it
 * IS mounted is still asserted below.
 *
 * The session store is a hand-built reactive stub — no Pinia, no transport
 * (same shape as controls.test.ts).
 */
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import type { OutcomeReason } from '@/entities/match'
import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({ store: {} as unknown }))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.store
}))

import { RoomMatch } from '@/features/room/match'

interface OutcomeStub {
  reason: OutcomeReason
  wpm: number
  acc: number
  score: number | null
  progress: number
}

/**
 * Only the slice of the store the match surface reads. `selfView` stays null so
 * the local GameField never mounts: this is a panel test, not a field test.
 */
function makeStore(outcome: OutcomeStub | null, racing = 2) {
  return reactive({
    phase: 'eliminated',
    selfOutcome: outcome,
    selfView: null,
    selfHud: { score: 0, combo: 0, multiplier: 1, modMultiplier: 1, wpm: 0, raw: 0 },
    room: null,
    countdownMsLeft: null,
    peers: Array.from({ length: racing }, (_, i) => ({
      playerId: `p${i}`,
      nick: `peer-${i}`,
      metrics: { wpm: 0, acc: 0, progress: 0 },
      status: 'racing' as const,
      failReason: null,
      caret: { wordIndex: 0, charIndex: 0 }
    }))
  })
}

const mountMatch = (outcome: OutcomeStub | null, racing = 2) => {
  h.store = makeStore(outcome, racing)
  // Pinia for the config store the local field's caret props are read from.
  return mount(RoomMatch, { global: { plugins: [i18n, createPinia()] } })
}

/** A normal freemod elimination — real numbers, so the stats line belongs. */
const minSpeedOutcome: OutcomeStub = {
  reason: 'minSpeed',
  wpm: 38.4,
  acc: 0.812,
  score: 900,
  progress: 0.37
}

/** The reload forfeit: the log died with the page, so there is nothing to report. */
const reloadOutcome: OutcomeStub = {
  reason: 'reload',
  wpm: 0,
  acc: 0,
  score: null,
  progress: 0
}

describe('RoomMatch — elimination panel', () => {
  it('names the freemod rule that ended the run and shows the frozen numbers', () => {
    const wrapper = mountMatch(minSpeedOutcome)
    const panel = wrapper.find('[data-testid="match-eliminated-panel"]')

    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain("you're out")
    expect(panel.text()).toContain('you dropped below the net wpm floor')

    const stats = wrapper.find('[data-testid="match-eliminated-stats"]')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('38')
    expect(stats.text()).toContain('81%')
    expect(stats.text()).toContain('37%')
    expect(stats.text()).toContain('900')
  })

  it('explains the reload forfeit and drops the all-zero stats line', () => {
    const wrapper = mountMatch(reloadOutcome)
    const panel = wrapper.find('[data-testid="match-eliminated-panel"]')

    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain(
      'your run ended when the page reloaded — the log did not survive it'
    )
    // Zeros here would read as a catastrophically bad run, not as "no data".
    expect(wrapper.find('[data-testid="match-eliminated-stats"]').exists()).toBe(false)
    // Title and the "the others are still going" line survive.
    expect(panel.text()).toContain("you're out")
    expect(panel.text()).toContain('waiting for the others to finish')
    expect(panel.text()).toContain('2 still racing')
  })

  it('renders no panel at all without an outcome', () => {
    const wrapper = mountMatch(null)
    expect(wrapper.find('[data-testid="match-eliminated-panel"]').exists()).toBe(false)
  })
})
