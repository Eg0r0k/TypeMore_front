import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ProfileActivity as ActivityData, ProfilePB, ProfileSummary } from '@shared/api'
import {
  ProfileActivity,
  ProfileDailyChart,
  ProfileHistogram,
  ProfilePBCards,
  ProfileSection,
  ProfileSummaryCard
} from '@/features/profile'
import { isoDay } from '@/features/profile/model/format'
import { groupThousands } from '@/shared/lib/helpers/numbers'
import en from '@/app/i18n/locales/en'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
// The header asks the dialogs store for settings (the dialog itself lives in
// App.vue), so a mount needs pinia.
const global = { plugins: [i18n, createPinia()] }

const summary: ProfileSummary = {
  displayName: 'boardsmoke',
  joined: '2026-07-01T10:00:00Z',
  testsStarted: 120,
  testsCompleted: 100,
  restartsPerCompleted: 0.2,
  timeTypingMs: 3_725_000,
  estimatedWordsTyped: 12_345,
  wpm: { highest: 113.07, average: 98.4, averageLast10: 105.2 },
  raw: { highest: 120.5, average: 104.1, averageLast10: 110.9 },
  acc: { highest: 1, average: 0.962, averageLast10: 0.973 },
  consistency: { highest: 0.83, average: 0.71, averageLast10: 0.76 },
  streak: { current: 3, best: 9 },
  languages: [
    { lang: 'german', tests: 60 },
    { lang: 'en', tests: 40 }
  ]
}

describe('profile summary — counters and the stats grid from a fixture', () => {
  it('renders identity, counters (with completion %) and all four metric groups', () => {
    const wrapper = mount(ProfileSummaryCard, { props: { summary }, global })
    expect(wrapper.find('[data-testid="profile-nick"]').text()).toBe('boardsmoke')
    expect(wrapper.find('[data-testid="profile-tests-started"]').text()).toContain('120')
    // completed carries its share of started
    const completed = wrapper.find('[data-testid="profile-tests-completed"]').text()
    expect(completed).toContain('100')
    expect(completed).toContain('83%')
    // Time typing is a clock, not prose — a total that only grows reads as one.
    expect(wrapper.find('[data-testid="profile-time-typing"]').text()).toBe('01:02:05')
    expect(wrapper.find('[data-testid="profile-words-typed"]').text()).toContain(
      groupThousands(12_345)
    )
    expect(wrapper.find('[data-testid="profile-restarts"]').text()).toContain('0.2')

    // The grid: speeds at one decimal, fractions as %.
    expect(wrapper.find('[data-testid="profile-wpm-highest"]').text()).toBe('113.1')
    expect(wrapper.find('[data-testid="profile-acc-average"]').text()).toBe('96%')
    expect(wrapper.find('[data-testid="profile-consistency-averageLast10"]').text()).toBe('76%')
    expect(wrapper.find('[data-testid="profile-languages"]').text()).toContain('german · 60')
  })

  // The streak lives with the join date: both answer "how long has this person
  // been around", and the calendar underneath stays a pure calendar.
  it('carries the streak line under the join date', () => {
    const wrapper = mount(ProfileSummaryCard, { props: { summary }, global })
    const streak = wrapper.find('[data-testid="profile-streak"]')
    expect(streak.text()).toContain('3')
    expect(streak.text()).toContain('9')
  })
})

describe('profile activity — the calendar', () => {
  it('renders played days as levelled cells, with the total and the scale', () => {
    const today = isoDay(new Date())
    const activity: ActivityData = {
      days: [{ date: today, tests: 5, timeMs: 300_000 }]
    }
    const wrapper = mount(ProfileActivity, { props: { activity }, global })
    const played = wrapper.findAll('[data-testid="profile-activity-day"]')
    expect(played).toHaveLength(1)
    // A played day is painted from the accent; an unplayed one is not.
    expect(played[0].attributes('style')).toContain('--main-color')
    expect(wrapper.find('[data-testid="profile-activity-total"]').text()).toContain('5')
    expect(wrapper.find('[data-testid="profile-activity-legend"]').exists()).toBe(true)
    // Seven weekday labels on the left rail, Monday first.
    expect(wrapper.text().toLowerCase()).toContain('mon')
  })

  /**
   * Today is marked with a ring (box-shadow), never a border: a border would
   * add a pixel of width and push its whole column off the grid the other 365
   * cells share.
   */
  it('marks today with a ring that costs no layout width', () => {
    const today = isoDay(new Date())
    const wrapper = mount(ProfileActivity, {
      props: { activity: { days: [{ date: today, tests: 5, timeMs: 300_000 }] } },
      global
    })
    const marked = wrapper.findAll('[data-today]')
    expect(marked).toHaveLength(1)
    expect(marked[0].attributes('data-date')).toBe(today)
    const classes = marked[0].classes().join(' ')
    expect(classes).toContain('ring-2')
    expect(classes).toContain('ring-text')
    expect(classes).not.toContain('border')
  })

  it('renders the honest empty state for a fresh account', () => {
    const wrapper = mount(ProfileActivity, { props: { activity: { days: [] } }, global })
    expect(wrapper.find('[data-testid="profile-activity-empty"]').exists()).toBe(true)
  })
})

describe('profile PB cards', () => {
  const pb: ProfilePB = {
    bucket: 'time:15000:german:seeded',
    mode: 'time',
    durationMs: 15000,
    wordCount: null,
    lang: 'german',
    textSource: 'seeded',
    quoteId: null,
    source: null,
    runId: 'run-1',
    score: 1645,
    wpm: 103.2,
    raw: 103.2,
    acc: 1,
    grade: 'SS',
    mods: {},
    achievedAt: '2026-07-20T12:00:00Z'
  }

  it('renders bucket label + score/wpm/acc/date and emits the race action', async () => {
    const wrapper = mount(ProfilePBCards, { props: { pbs: [pb] }, global })
    const card = wrapper.find('[data-testid="profile-pb-time:15000:german:seeded"]')
    expect(card.text()).toContain('time 15s · german')
    expect(card.text()).toContain(groupThousands(1645))
    expect(card.text()).toContain('103.2')
    expect(card.text()).toContain('SS')

    await card.find('[data-testid="profile-pb-race-time:15000:german:seeded"]').trigger('click')
    expect(wrapper.emitted('race')).toEqual([['run-1']])
  })

  it('renders the empty state without cards', () => {
    const wrapper = mount(ProfilePBCards, { props: { pbs: [] }, global })
    expect(wrapper.find('[data-testid="profile-pbs-empty"]').exists()).toBe(true)
  })
})

describe('profile charts — fixtures and empty states', () => {
  it('draws one histogram bar per populated bucket, zeros filled between', () => {
    const wrapper = mount(ProfileHistogram, {
      props: {
        histogram: {
          buckets: [
            { wpm: 60, tests: 3 },
            { wpm: 80, tests: 1 }
          ]
        }
      },
      global
    })
    // 60, 70 (zero-filled), 80.
    expect(wrapper.findAll('rect')).toHaveLength(3)
  })

  it('shows the empty state when there are no buckets', () => {
    const wrapper = mount(ProfileHistogram, { props: { histogram: { buckets: [] } }, global })
    expect(wrapper.find('[data-testid="profile-histogram-empty"]').exists()).toBe(true)
  })

  it('daily chart renders bars + line and follows the metric toggle', async () => {
    const timeseries = {
      days: [
        { date: '2026-07-27', timeTypingMs: 600_000, avgWpm: 90, avgAcc: 0.95 },
        { date: '2026-07-28', timeTypingMs: 300_000, avgWpm: 100, avgAcc: 0.99 }
      ],
      wpmPerHour: 2.5
    }
    const wrapper = mount(ProfileDailyChart, {
      props: { timeseries, metric: 'speed' as const, smoothing: 10 },
      global
    })
    expect(wrapper.findAll('rect')).toHaveLength(2)
    const speedLine = wrapper.find('[data-testid="profile-daily-line"]').attributes('d')
    expect(speedLine).toBeTruthy()

    await wrapper.setProps({ metric: 'accuracy' })
    const accLine = wrapper.find('[data-testid="profile-daily-line"]').attributes('d')
    expect(accLine).toBeTruthy()
    expect(accLine).not.toBe(speedLine)

    // The dotted trend exists in both.
    expect(wrapper.find('[data-testid="profile-daily-trend"]').attributes('d')).toBeTruthy()
  })

  it('daily chart shows the empty state for an empty range', () => {
    const wrapper = mount(ProfileDailyChart, {
      props: { timeseries: { days: [], wpmPerHour: 0 }, metric: 'speed' as const, smoothing: 10 },
      global
    })
    expect(wrapper.find('[data-testid="profile-daily-empty"]').exists()).toBe(true)
  })
})

describe('profile section — one failed aggregate retries alone', () => {
  it('renders the error card with a retry that emits', async () => {
    const wrapper = mount(ProfileSection, {
      props: { name: 'summary', error: true },
      global
    })
    expect(wrapper.find('[data-testid="profile-error-summary"]').exists()).toBe(true)
    await wrapper.find('[data-testid="profile-retry-summary"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders the skeleton while loading', () => {
    const wrapper = mount(ProfileSection, { props: { name: 'pbs', loading: true }, global })
    expect(wrapper.find('[data-testid="profile-loading-pbs"]').exists()).toBe(true)
  })

  /**
   * The anti-flicker contract: a refetch over data that is already on screen
   * must NOT swap the content for a skeleton — the slot stays mounted (same
   * DOM node, same chart geometry) and only gets a spinner on top.
   */
  it('keeps the content mounted during a refetch and floats a spinner instead', async () => {
    const wrapper = mount(ProfileSection, {
      props: { name: 'charts', busy: false },
      slots: { default: '<b data-testid="chart">chart</b>' },
      global
    })
    const before = wrapper.find('[data-testid="chart"]').element
    expect(wrapper.find('[data-testid="profile-busy-charts"]').exists()).toBe(false)

    await wrapper.setProps({ busy: true })
    expect(wrapper.find('[data-testid="profile-busy-charts"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-loading-charts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="chart"]').element).toBe(before)
  })
})
