import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ProfileSummary } from '@shared/api'
import { ProfileIdentitySkeleton, ProfileSection, ProfileSummaryCard } from '@/features/profile'
import { wpmSeries } from '@/features/profile/model/format'
import en from '@/app/i18n/locales/en'

/**
 * The profile HEADER — banner, avatar, name, meta, counters, language chips.
 *
 * The states are the point here, not the pixels: what the header does with an
 * account that has nothing yet, with a name too long for its column, with more
 * languages than fit, and with a streak of zero. Each of those is a shape the
 * page must not fall apart in.
 */

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', name: 'home', component: { template: '<div />' } }]
})
const global = { plugins: [i18n, router, createPinia()] }

const zero = { highest: 0, average: 0, averageLast10: 0 }

const summaryOf = (over: Partial<ProfileSummary> = {}): ProfileSummary => ({
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
    { lang: 'english', tests: 40 }
  ],
  ...over
})

const mountHeader = (summary: ProfileSummary, props: Record<string, unknown> = {}) =>
  mount(ProfileSummaryCard, { props: { summary, part: 'identity', ...props }, global })

describe('profile header — identity, meta and counters', () => {
  it('names the player, dates them, and counts what the server counts', () => {
    const wrapper = mountHeader(summaryOf())

    expect(wrapper.find('[data-testid="profile-nick"]').text()).toBe('boardsmoke')
    expect(wrapper.find('[data-testid="profile-joined"]').text()).toContain('2026')
    // The three counters: runs judged, time measured, days since the join date.
    expect(wrapper.find('[data-testid="profile-counter-runs"]').text()).toBe('100')
    expect(wrapper.find('[data-testid="profile-counter-time"]').text()).toBe('01:02:05')
    expect(Number(wrapper.find('[data-testid="profile-counter-days"]').text())).toBeGreaterThan(0)
  })

  it('states a streak, and states its absence instead of showing a zero', () => {
    const running = mountHeader(summaryOf())
    expect(running.find('[data-testid="profile-streak"]').text()).toContain('3')
    expect(running.find('[data-testid="profile-streak"]').text()).toContain('9')

    const none = mountHeader(summaryOf({ streak: { current: 0, best: 0 } }))
    const streak = none.find('[data-testid="profile-streak"]')
    expect(streak.text()).toBe(en.profile.identity.noStreak)
    // The icon goes with the number it qualified.
    expect(streak.find('svg').exists()).toBe(false)
  })

  it('makes the OWN avatar the way into settings, and only that one', () => {
    const own = mountHeader(summaryOf(), { own: true })
    const trigger = own.find('[data-testid="profile-settings"]')
    expect(trigger.exists()).toBe(true)
    // A real button carrying the name; the avatar inside it is decoration.
    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.attributes('aria-label')).toBe(en.settings.title)
    expect(own.find('[data-testid="profile-avatar"]').exists()).toBe(true)

    // Somebody else's page: a face, and no way into your settings from it.
    const other = mountHeader(summaryOf())
    expect(other.find('[data-testid="profile-settings"]').exists()).toBe(false)
    expect(other.find('[data-testid="profile-avatar"]').exists()).toBe(true)
  })

  it('truncates a long name and keeps it whole in the title', () => {
    const long = 'abcdefghijklmnopqrstuvwx'
    const nick = mountHeader(summaryOf({ displayName: long })).find('[data-testid="profile-nick"]')
    expect(nick.attributes('title')).toBe(long)
    expect(nick.classes()).toContain('truncate')
  })
})

describe('profile header — languages', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    lang: `lang${i}`,
    tests: 10_000 - i * 700
  }))

  it('shows the five most-played, then the rest on request', async () => {
    const wrapper = mountHeader(summaryOf({ languages: [...many].reverse() }))
    const chips = () => wrapper.findAll('[data-testid="profile-languages"] span.rounded-\\[6px\\]')

    // Sorted by tests descending, whatever order the server sent.
    expect(chips()).toHaveLength(5)
    expect(chips()[0]?.text()).toContain('lang0')

    const more = wrapper.find('[data-testid="profile-languages-more"]')
    expect(more.text()).toContain('7')
    expect(more.attributes('aria-expanded')).toBe('false')

    await more.trigger('click')
    expect(chips()).toHaveLength(12)
    expect(wrapper.find('[data-testid="profile-languages-more"]').attributes('aria-expanded')).toBe(
      'true'
    )
  })

  it('tells a brand-new account where to start instead of showing an empty strip', () => {
    const wrapper = mountHeader(
      summaryOf({
        testsStarted: 0,
        testsCompleted: 0,
        timeTypingMs: 0,
        estimatedWordsTyped: 0,
        languages: [],
        streak: { current: 0, best: 0 },
        wpm: zero,
        raw: zero,
        acc: zero,
        consistency: zero,
        joined: new Date().toISOString()
      })
    )

    expect(wrapper.find('[data-testid="profile-no-runs"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-no-runs"] a').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-languages-more"]').exists()).toBe(false)
    // Nothing to draw a line from, either.
    expect(wrapper.find('[data-testid="profile-sparkline"]').exists()).toBe(false)
  })
})

describe('profile header — the banner sparkline', () => {
  it('draws nothing until a handful of runs have something to say', () => {
    const four = mountHeader(summaryOf(), { recentWpm: [80, 90, 85, 95] })
    expect(four.find('[data-testid="profile-sparkline"]').exists()).toBe(false)

    const five = mountHeader(summaryOf(), { recentWpm: [80, 90, 85, 95, 100] })
    const svg = five.find('[data-testid="profile-sparkline"]')
    expect(svg.exists()).toBe(true)
    // One curve segment between each pair of runs, and no accessible name: the
    // line is decoration.
    expect(svg.find('path[fill="none"]').attributes('d')?.split(' C ')).toHaveLength(5)
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('takes the SERVER wpm of a run page, oldest first', () => {
    const series = wpmSeries([
      { serverMetrics: { wpm: 120 } },
      { serverMetrics: null }, // still under review — no verified number
      { serverMetrics: { wpm: 90 } }
    ])
    expect(series).toEqual([90, 120])
  })
})

describe('profile header — the first load', () => {
  it('reserves the header geometry with its own skeleton', () => {
    const wrapper = mount(ProfileSection, {
      props: { name: 'summary', loading: true },
      slots: { skeleton: ProfileIdentitySkeleton },
      global
    })
    expect(wrapper.find('[data-testid="profile-identity-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-loading-summary"]').exists()).toBe(true)
  })

  it('leaves every other section the plain block it always had', () => {
    const wrapper = mount(ProfileSection, { props: { name: 'pbs', loading: true }, global })
    expect(wrapper.find('[data-testid="profile-loading-pbs"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-identity-skeleton"]').exists()).toBe(false)
  })
})
