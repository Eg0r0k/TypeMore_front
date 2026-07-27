/**
 * The room's result screen: the local player's own run on top — the SOLO results
 * view, reused rather than re-implemented — and one row per participant below it.
 *
 * Table contract: the amount column follows the room mode (finish time in
 * `words`, score in `time`), the self row is highlighted, connection loss during
 * results disables the rematch button instead of blowing the screen away, and an
 * eliminated row (wire status `finished`, `failReason` set) shows the reason
 * rather than a bogus clean finish.
 *
 * The `live` arm is the eliminated seat's screen: the match is still on, so the
 * rows carry the racing statuses, they are ordered by canonical progress, and
 * there is no rematch to accept yet.
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { h, nextTick, reactive } from 'vue'

import { RoomResults } from '@/features/room/results'
import type { MatchSelfRun } from '@/features/room/results'
import type { StandingRow } from '@/entities/lobby'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { i18n } from '@app/i18n'
import type { Metrics } from '@shared/core'

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
      raw: 88.9,
      acc: 0.943,
      chars: { correct: 200, incorrect: 6, extra: 1, missed: 2 },
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

/** The live table an eliminated seat watches: opponents still racing, self out. */
function liveRows(): StandingRow[] {
  return [
    {
      rank: 1,
      playerId: 'p2',
      nick: 'Neo',
      isSelf: false,
      status: 'racing',
      wpm: 96.4,
      acc: 0.982,
      failReason: null,
      progress: 0.71,
      freemods: NO_MODS
    },
    {
      rank: 2,
      playerId: 'p1',
      nick: 'Trinity',
      isSelf: true,
      status: 'eliminated',
      wpm: 38.5,
      raw: 44.1,
      acc: 0.81,
      chars: { correct: 90, incorrect: 12, extra: 0, missed: 3 },
      failReason: 'minSpeed',
      progress: 0.37,
      freemods: { difficulty: 'normal', minWpm: 60, nospace: false }
    }
  ]
}

const metrics: Metrics = {
  wpm: 81.2,
  raw: 88.9,
  accuracy: 0.943,
  consistency: 74,
  chars: { correct: 200, incorrect: 6, extra: 1, missed: 2 },
  spaces: 40,
  durationSec: 16
}

const selfRun: MatchSelfRun = {
  metrics,
  timeline: [],
  score: null,
  activeMods: [],
  failReason: null,
  afkMs: 0,
  summary: {
    mode: 'words',
    language: 'english',
    difficulty: 'normal',
    amount: 25,
    punctuation: false,
    numbers: false,
    randomCase: false,
    nospace: false
  }
}

// The solo results view reports "copy screenshot" through the alert store, and
// its icon actions are tooltipped — hence the pinia and the TooltipProvider (the
// app installs the latter once, in App.vue).
beforeEach(() => setActivePinia(createPinia()))

type Props = Partial<InstanceType<typeof RoomResults>['$props']>

const mountResults = (props: Props) =>
  mount(TooltipProvider, {
    global: { plugins: [i18n] },
    slots: { default: () => h(RoomResults, props as Record<string, unknown>) }
  }).findComponent(RoomResults)

const mountTable = (standings: StandingRow[], mode: 'time' | 'words', connectionLost = false) =>
  mountResults({ standings, mode, connectionLost })

describe('RoomResults — standings table', () => {
  it('words mode: amount column is the finish time', () => {
    const wrapper = mountTable(wordsRows(), 'words')

    expect(wrapper.find('thead').text()).toContain('time')
    const amounts = wrapper.findAll('[data-testid="standings-amount"]')
    expect(amounts[0].text()).toBe('12.3s')
    expect(amounts[1].text()).toBe('16.0s')
    // A dnf seat has no finish time.
    expect(amounts[2].text()).toBe('—')
  })

  it('time mode: amount column is the score', () => {
    const wrapper = mountTable(timeRows(), 'time')

    expect(wrapper.find('thead').text()).toContain('score')
    const amounts = wrapper.findAll('[data-testid="standings-amount"]')
    expect(amounts[0].text()).toBe('4200')
    // A seat that left mid-match has no score.
    expect(amounts[1].text()).toBe('—')
  })

  it('highlights the self row and renders rank, wpm, acc, and freemod chips', () => {
    const wrapper = mountTable(wordsRows(), 'words')

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

  /**
   * The two columns the solo screen has always carried and the standings never
   * did. Only the local seat can fill them today — the session store folds a
   * full `Metrics` per player but publishes wpm and acc alone — so an opponent's
   * cells say "unknown" rather than zero.
   */
  it('pairs wpm with raw and spells out the char breakdown, blank where unknown', () => {
    const wrapper = mountTable(wordsRows(), 'words')

    expect(wrapper.find('thead').text()).toContain('wpm / raw')
    const wpm = wrapper.findAll('[data-testid="standings-wpm"]')
    expect(wpm[1].text().replace(/\s+/g, '')).toBe('81/89')
    // No raw for an opponent: the net number stands alone rather than reading /0.
    expect(wpm[0].text().replace(/\s+/g, '')).toBe('96')

    const chars = wrapper.findAll('[data-testid="standings-chars"]')
    expect(chars[1].text()).toBe('200/6/1/2')
    expect(chars[0].text()).toBe('—')
  })

  it('re-ready emits while connected and is disabled on connection loss', async () => {
    const wrapper = mountTable(wordsRows(), 'words')
    await wrapper.find('[data-testid="re-ready-button"]').trigger('click')
    expect(wrapper.emitted('reReady')).toHaveLength(1)

    const lost = mountTable(wordsRows(), 'words', true)
    expect(lost.find('[data-testid="re-ready-button"]').attributes('disabled')).toBeDefined()
    expect(lost.find('[data-testid="results-connection-lost"]').exists()).toBe(true)
  })

  it('renders the match-end reason line only for forced endings (Δ3)', () => {
    const natural = mountResults({ standings: wordsRows(), mode: 'words', reason: 'all_finished' })
    expect(natural.find('[data-testid="results-reason"]').exists()).toBe(false)

    const deadline = mountResults({ standings: timeRows(), mode: 'time', reason: 'deadline' })
    expect(deadline.find('[data-testid="results-reason"]').text()).toBe('match ended: time up')

    const window = mountResults({ standings: wordsRows(), mode: 'words', reason: 'finish_window' })
    expect(window.find('[data-testid="results-reason"]').text()).toBe(
      'match ended: finish window closed'
    )
  })

  it('an eliminated row shows the fail reason and no amount, leaving finishers untouched', () => {
    const wrapper = mountTable(eliminatedRows(), 'time')
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
    const wrapper = mountTable(rows, 'words')

    const statuses = wrapper.findAll('[data-testid="standings-status"]')
    expect(statuses[2].text()).toBe('dnf · afk 62%')
  })

  it('a finisher with a meaningful afk share still gets the percentage', () => {
    const rows = wordsRows()
    rows[0] = { ...rows[0], afkShare: 0.084 }
    const wrapper = mountTable(rows, 'words')

    expect(wrapper.findAll('[data-testid="standings-status"]')[0].text()).toBe('finished · afk 8%')
  })

  /** Below the display floor the share is bucket noise, not a story. */
  it('omits the percentage for an afk share under the display floor', () => {
    const rows = wordsRows()
    rows[1] = { ...rows[1] }
    const wrapper = mountTable(rows, 'words')

    const statuses = wrapper.findAll('[data-testid="standings-status"]')
    expect(statuses[0].text()).toBe('finished')
    // An absent share is not a zero share — it renders nothing either.
    expect(statuses[1].text()).toBe('finished')
  })
})

describe('RoomResults — the local player’s own run', () => {
  /**
   * The point of the rework: a match result is the SAME screen a solo run gets.
   * Asserting the solo view's own testids is what proves it was reused and not
   * copied — a fork would drift out of this test on its first redesign.
   */
  it('renders the solo results view above the table', () => {
    const wrapper = mountResults({ standings: wordsRows(), mode: 'words', self: selfRun })
    const run = wrapper.find('[data-testid="results-self-run"]')

    expect(run.exists()).toBe(true)
    // The solo stats row, verbatim: wpm/raw, acc, the char breakdown, time.
    expect(run.text()).toContain('81')
    expect(run.text()).toContain('89')
    expect(run.text()).toContain('94%')
    expect(run.text()).toContain('200/6/1/2')
  })

  /** A match has no next test to load and no replay screen to open. */
  it('offers the screenshot action alone — never next test or replay', () => {
    const wrapper = mountResults({ standings: wordsRows(), mode: 'words', self: selfRun })

    expect(wrapper.find('[data-testid="results-screenshot"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="results-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="results-replay"]').exists()).toBe(false)
  })

  /** A reload forfeit has no log left: there is no run to draw, only the table. */
  it('draws no run view when there is no run behind the seat', () => {
    const wrapper = mountResults({ standings: wordsRows(), mode: 'words', self: null })
    expect(wrapper.find('[data-testid="results-self-run"]').exists()).toBe(false)
    expect(wrapper.find('.standings__table').exists()).toBe(true)
  })
})

describe('RoomResults — live (eliminated, match still running)', () => {
  const mountLive = () =>
    mountResults({
      standings: liveRows(),
      mode: 'time',
      self: selfRun,
      live: true,
      racingCount: 2,
      outcomeReason: 'minSpeed'
    })

  it('names the rule that ended the run and what it is still waiting on', () => {
    const note = mountLive().find('[data-testid="results-live"]')

    expect(note.text()).toContain('you dropped below the net wpm floor')
    expect(note.text()).toContain('waiting for the others to finish')
    expect(note.text()).toContain('2 still racing')
  })

  /** Nothing to re-ready into: the match this seat is out of is still being run. */
  it('withholds the rematch button while the match is still on', () => {
    const wrapper = mountLive()
    expect(wrapper.find('[data-testid="re-ready-button"]').exists()).toBe(false)
    // Leaving, however, is always on offer.
    expect(wrapper.findAll('button').length).toBeGreaterThan(0)
  })

  /**
   * A live row's status is the racing one, not one of the three a final standing
   * can carry — and a racing opponent has no amount to show yet.
   */
  it('renders the racing statuses and no amount for a seat still going', () => {
    const wrapper = mountLive()
    const statuses = wrapper.findAll('[data-testid="standings-status"]')

    expect(statuses[0].text()).toBe('racing')
    expect(statuses[1].text()).toBe('out · min speed')
    expect(wrapper.findAll('[data-testid="standings-amount"]')[0].text()).toBe('—')
  })

  /**
   * The opponent's numbers come off the session store's live `peers` view, so
   * the row has to follow them where it stands — no remount, no re-entry.
   */
  it('follows an opponent’s numbers as they keep typing', async () => {
    const state = reactive({ standings: liveRows() })
    const wrapper = mount(TooltipProvider, {
      global: { plugins: [i18n] },
      slots: {
        default: () =>
          h(RoomResults, { standings: state.standings, mode: 'time', live: true, racingCount: 1 })
      }
    })
    expect(wrapper.findAll('[data-testid="standings-wpm"]')[0].text()).toContain('96')

    state.standings = [{ ...state.standings[0], wpm: 104.2 }, state.standings[1]]
    await nextTick()

    expect(wrapper.findAll('[data-testid="standings-wpm"]')[0].text()).toContain('104')
  })
})
