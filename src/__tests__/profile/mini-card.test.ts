/**
 * The lobby's mini profile card.
 *
 * The three things worth pinning are all about REFUSALS, because the card is
 * shown for a player the viewer did not choose to look up:
 *
 *  - a closed profile must not be asked for its numbers at all (the server
 *    already answered "no" once, and a second question is a 403 per hover);
 *  - a 404 — a name that does not exist, or a banned account, deliberately
 *    indistinguishable — says so and asks for nothing further;
 *  - an open profile shows what the header carries and nothing invented.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import en from '@/app/i18n/locales/en'

const h = vi.hoisted(() => ({ header: vi.fn(), summary: vi.fn() }))

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>()
  return {
    ...actual,
    publicProfileQueryOptions: (name: string) => ({
      queryKey: ['header', name],
      queryFn: h.header,
      retry: false
    }),
    publicProfileSummaryQueryOptions: (name: string) => ({
      queryKey: ['summary', name],
      queryFn: h.summary,
      retry: false
    })
  }
})

import { ApiError, LINK_PREFIXES } from '@shared/api'
import { ProfileMiniCard } from '@/features/profile'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/u/:name', name: 'user', component: { template: '<div />' } }
  ]
})

const header = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  name: 'ada',
  joined: '2026-01-05T00:00:00Z',
  public: true,
  bio: 'types words for a living',
  keyboard: 'Keychron Q1',
  links: [{ kind: 'github', handle: 'ada' }],
  badges: ['staff', 'a_badge_from_the_future'],
  ...over
})

const metric = (value: number) => ({ highest: value, average: value, averageLast10: value })

const summary = () => ({
  displayName: 'ada',
  joined: '2026-01-05T00:00:00Z',
  testsStarted: 120,
  testsCompleted: 100,
  restartsPerCompleted: 0.2,
  timeTypingMs: 600_000,
  estimatedWordsTyped: 2000,
  wpm: metric(97.4),
  raw: metric(105),
  acc: metric(0.96),
  consistency: metric(0.8),
  streak: { current: 3, best: 9 },
  languages: [{ lang: 'english', tests: 100 }]
})

const mountCard = async (name = 'ada') => {
  const wrapper = mount(ProfileMiniCard, {
    props: { name },
    global: {
      plugins: [
        i18n,
        router,
        createPinia(),
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
        ]
      ]
    }
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  h.header.mockReset()
  h.summary.mockReset()
})

describe('profile mini card', () => {
  it('shows an open profile with the numbers a lobby is asking about', async () => {
    h.header.mockResolvedValue(header())
    h.summary.mockResolvedValue(summary())

    const wrapper = await mountCard()

    expect(wrapper.text()).toContain('ada')
    expect(wrapper.find('[data-testid="profile-mini-bio"]').text()).toBe(
      'types words for a living'
    )
    expect(wrapper.find('[data-testid="profile-mini-keyboard"]').text()).toContain('Keychron Q1')
    // wpm rounded, accuracy as a percent, tests as a count.
    const stats = wrapper.find('[data-testid="profile-mini-stats"]').text()
    expect(stats).toContain('97')
    expect(stats).toContain('96%')
    expect(stats).toContain('100')
    // A code this build cannot draw renders as nothing — one chip, not two.
    expect(wrapper.findAll('[data-testid="badge-chip"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="profile-mini-link-github"]').attributes('href')).toBe(
      LINK_PREFIXES.github + 'ada'
    )
  })

  it('never asks a closed profile for its numbers', async () => {
    h.header.mockResolvedValue(header({ public: false, bio: null, links: [], badges: [] }))

    const wrapper = await mountCard()

    expect(wrapper.find('[data-testid="profile-mini-closed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-mini-stats"]').exists()).toBe(false)
    expect(h.summary).not.toHaveBeenCalled()
    // The name is still there — a closed profile is a state, not a dead end.
    expect(wrapper.text()).toContain('ada')
  })

  it('offers no way in when the server says there is nobody', async () => {
    // 404 covers "no such name" and "banned account" on purpose; the card must
    // not tell them apart either.
    h.header.mockRejectedValue(new ApiError({ status: 404, code: 'not_found', message: 'not found' }))

    const wrapper = await mountCard('ghost')

    expect(wrapper.find('[data-testid="profile-mini-missing"]').exists()).toBe(true)
    expect(h.summary).not.toHaveBeenCalled()
  })

  it('says so, rather than pretending, when the request itself fails', async () => {
    h.header.mockRejectedValue(new ApiError({ status: 500, code: 'internal', message: 'boom' }))

    const wrapper = await mountCard()

    expect(wrapper.find('[data-testid="profile-mini-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-mini-stats"]').exists()).toBe(false)
  })
})
