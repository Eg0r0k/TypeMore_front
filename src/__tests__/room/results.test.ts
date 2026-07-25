/**
 * Standings table contract: the amount column follows the room mode — finish
 * time in `words` mode, score in `time` mode — the self row is highlighted,
 * connection loss during results disables the rematch button instead of
 * blowing the screen away, and an eliminated row (wire status `finished`,
 * `failReason` set) shows the reason rather than a bogus clean finish.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { RoomResults } from '@/features/room/results'
import type { StandingRow } from '@/entities/lobby'
import { i18n } from '@app/i18n'

const NO_MODS = { difficulty: 'normal', minWpm: 0, nospace: false } as const

/** Words-mode standings: finishers carry finishTimeMs (never score). */
function wordsRows(): StandingRow[] {
  return [
    {
      rank: 1,
      playerId: 'p2',
      nick: 'Neo',
      isSelf: false,
      status: 'finished',
      finishTimeMs: 12340,
      wpm: 96.4,
      acc: 0.982,
      progress: 1,
      freemods: { difficulty: 'expert', minWpm: 60, nospace: false }
    },
    {
      rank: 2,
      playerId: 'p1',
      nick: 'Trinity',
      isSelf: true,
      status: 'finished',
      finishTimeMs: 15980,
      wpm: 81.2,
      acc: 0.943,
      progress: 1,
      freemods: NO_MODS
    },
    {
      rank: 3,
      playerId: 'p3',
      nick: 'Guest-4831',
      isSelf: false,
      status: 'dnf',
      progress: 0.4,
      freemods: NO_MODS
    }
  ]
}

/** Time-mode standings: finishers carry score (never finishTimeMs). */
function timeRows(): StandingRow[] {
  return [
    {
      rank: 1,
      playerId: 'p2',
      nick: 'Neo',
      isSelf: false,
      status: 'finished',
      score: 4200,
      wpm: 96.4,
      acc: 0.982,
      progress: 1,
      freemods: NO_MODS
    },
    {
      rank: 2,
      playerId: 'p1',
      nick: 'Trinity',
      isSelf: true,
      status: 'left',
      progress: 0.22,
      freemods: NO_MODS
    }
  ]
}

/**
 * A freemod elimination: the WIRE status is a plain `finished`, so only
 * `failReason` tells the table this run never actually completed the text.
 */
function eliminatedRows(): StandingRow[] {
  return [
    {
      rank: 1,
      playerId: 'p2',
      nick: 'Neo',
      isSelf: false,
      status: 'finished',
      score: 4200,
      wpm: 96.4,
      acc: 0.982,
      progress: 1,
      freemods: NO_MODS
    },
    {
      rank: 2,
      playerId: 'p1',
      nick: 'Trinity',
      isSelf: true,
      status: 'finished',
      score: 900,
      wpm: 38.5,
      acc: 0.81,
      failReason: 'minSpeed',
      progress: 0.37,
      freemods: { difficulty: 'normal', minWpm: 60, nospace: false }
    }
  ]
}

const mountResults = (standings: StandingRow[], mode: 'time' | 'words', connectionLost = false) =>
  mount(RoomResults, {
    global: { plugins: [i18n] },
    props: { standings, mode, connectionLost }
  })

describe('RoomResults — standings table', () => {
  it('words mode: amount column is the finish time', () => {
    const wrapper = mountResults(wordsRows(), 'words')

    expect(wrapper.find('thead').text()).toContain('time')
    const amounts = wrapper.findAll('[data-testid="standings-amount"]')
    expect(amounts[0].text()).toBe('12.3s')
    expect(amounts[1].text()).toBe('16.0s')
    // A dnf seat has no finish time.
    expect(amounts[2].text()).toBe('—')
  })

  it('time mode: amount column is the score', () => {
    const wrapper = mountResults(timeRows(), 'time')

    expect(wrapper.find('thead').text()).toContain('score')
    const amounts = wrapper.findAll('[data-testid="standings-amount"]')
    expect(amounts[0].text()).toBe('4200')
    // A seat that left mid-match has no score.
    expect(amounts[1].text()).toBe('—')
  })

  it('highlights the self row and renders rank, wpm, acc, and freemod chips', () => {
    const wrapper = mountResults(wordsRows(), 'words')

    const self = wrapper.find('[data-testid="standings-self"]')
    expect(self.exists()).toBe(true)
    expect(self.classes()).toContain('standings__row--self')
    expect(self.text()).toContain('Trinity')
    expect(self.text()).toContain('you')
    expect(self.text()).toContain('81')
    expect(self.text()).toContain('94%')

    // Winner's freemod chips are visible in its row.
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('expert')
    expect(rows[0].text()).toContain('min speed 60')
  })

  it('re-ready emits while connected and is disabled on connection loss', async () => {
    const wrapper = mountResults(wordsRows(), 'words')
    await wrapper.find('[data-testid="re-ready-button"]').trigger('click')
    expect(wrapper.emitted('reReady')).toHaveLength(1)

    const lost = mountResults(wordsRows(), 'words', true)
    expect(lost.find('[data-testid="re-ready-button"]').attributes('disabled')).toBeDefined()
    expect(lost.find('[data-testid="results-connection-lost"]').exists()).toBe(true)
  })

  it('renders the match-end reason line only for forced endings (Δ3)', () => {
    const natural = mount(RoomResults, {
      global: { plugins: [i18n] },
      props: { standings: wordsRows(), mode: 'words' as const, reason: 'all_finished' as const }
    })
    expect(natural.find('[data-testid="results-reason"]').exists()).toBe(false)

    const deadline = mount(RoomResults, {
      global: { plugins: [i18n] },
      props: { standings: timeRows(), mode: 'time' as const, reason: 'deadline' as const }
    })
    expect(deadline.find('[data-testid="results-reason"]').text()).toBe('match ended: time up')

    const window = mount(RoomResults, {
      global: { plugins: [i18n] },
      props: { standings: wordsRows(), mode: 'words' as const, reason: 'finish_window' as const }
    })
    expect(window.find('[data-testid="results-reason"]').text()).toBe(
      'match ended: finish window closed'
    )
  })

  it('an eliminated row shows the fail reason and no amount, leaving finishers untouched', () => {
    const wrapper = mountResults(eliminatedRows(), 'time')
    const rows = wrapper.findAll('tbody tr')
    const amounts = wrapper.findAll('[data-testid="standings-amount"]')

    // The true finisher above it renders exactly as before.
    expect(rows[0].text()).toContain('Neo')
    expect(rows[0].find('.standings__status').text()).toBe('finished')
    expect(rows[0].classes()).not.toContain('standings__row--out')
    expect(amounts[0].text()).toBe('4200')

    // The eliminated seat: wire-`finished`, but named as out with its reason…
    expect(rows[1].find('.standings__status').text()).toBe('out · min speed')
    expect(rows[1].classes()).toContain('standings__row--out')
    // …and no score, however much the wire reported.
    expect(amounts[1].text()).toBe('—')
  })

  /**
   * Δ: the words-mode idle rule is now an AFK-SHARE rule, so a `dnf` can mean
   * "sat still for most of the match". The share is measured by the SERVER
   * (batch arrival buckets) and relayed on `match_end` — without printing it
   * the row is an unexplained dnf.
   */
  it('renders the server-measured afk share next to the status', () => {
    const rows = wordsRows()
    rows[2] = { ...rows[2], status: 'dnf', afkShare: 0.62 }
    const wrapper = mountResults(rows, 'words')

    const statuses = wrapper.findAll('[data-testid="standings-status"]')
    expect(statuses[2].text()).toBe('dnf · afk 62%')
  })

  it('a finisher with a meaningful afk share still gets the percentage', () => {
    const rows = wordsRows()
    rows[0] = { ...rows[0], afkShare: 0.084 }
    const wrapper = mountResults(rows, 'words')

    expect(wrapper.findAll('[data-testid="standings-status"]')[0].text()).toBe('finished · afk 8%')
  })

  /** Below the display floor the share is bucket noise, not a story. */
  it('omits the percentage for an afk share under the display floor', () => {
    const rows = wordsRows()
    rows[1] = { ...rows[1] }
    const wrapper = mountResults(rows, 'words')

    const statuses = wrapper.findAll('[data-testid="standings-status"]')
    expect(statuses[0].text()).toBe('finished')
    // An absent share is not a zero share — it renders nothing either.
    expect(statuses[1].text()).toBe('finished')
  })
})
