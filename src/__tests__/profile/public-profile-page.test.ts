import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import en from '@/app/i18n/locales/en'

/**
 * /u/{name} — the page renders the SERVER's answers as states. The API layer
 * is the mock boundary: every section's queryFn is a spy, so the tests can
 * assert not only what rendered but what was ASKED — a closed profile must
 * not even request data, because hiding sections over an API that answers
 * would be privacy theatre (the server refuses anyway; the client just does
 * not knock).
 */
const h = vi.hoisted(() => {
  class MockApiError extends Error {
    readonly status: number
    readonly code: string
    constructor(status: number, code: string) {
      super(code)
      this.status = status
      this.code = code
    }
  }
  return {
    MockApiError,
    header: vi.fn(),
    summary: vi.fn(),
    activity: vi.fn(),
    pbs: vi.fn(),
    histogram: vi.fn(),
    timeseries: vi.fn(),
    portrait: vi.fn(),
    me: vi.fn(),
    fetchQuery: vi.fn()
  }
})

vi.mock('@shared/api', () => ({
  isApiError: (value: unknown): boolean => value instanceof h.MockApiError,
  meQueryOptions: () => ({ queryKey: ['me'], queryFn: h.me, retry: false }),
  publicProfileQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'header'],
    queryFn: h.header,
    retry: false
  }),
  publicProfileSummaryQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'summary'],
    queryFn: h.summary,
    retry: false
  }),
  publicProfileActivityQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'activity'],
    queryFn: h.activity,
    retry: false
  }),
  publicProfilePBsQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'pbs'],
    queryFn: h.pbs,
    retry: false
  }),
  publicProfileHistogramQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'histogram'],
    queryFn: h.histogram,
    retry: false
  }),
  publicProfileTimeseriesQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'timeseries'],
    queryFn: h.timeseries,
    retry: false
  }),
  publicProfilePortraitQueryOptions: (name: string) => ({
    queryKey: ['users', name, 'portrait'],
    queryFn: h.portrait,
    retry: false
  }),
  // The runs table inside the page goes through the imperative cache handle.
  queryClient: { fetchQuery: h.fetchQuery },
  runsQueryOptions: (cursor?: string) => ({ queryKey: ['runs', cursor ?? null] }),
  publicProfileRunsQueryOptions: (name: string, cursor?: string) => ({
    queryKey: ['users', name, 'runs', cursor ?? null]
  }),
  quoteByIdQueryOptions: (id: string) => ({
    queryKey: ['quote', id],
    queryFn: () => Promise.resolve(undefined)
  }),
  keyboardLayoutsQueryOptions: () => ({
    queryKey: ['layouts'],
    queryFn: () => Promise.resolve({ layouts: [] })
  })
}))

import UserPage from '@/pages/user/ui.vue'
import { useAuthStore } from '@/entities/auth'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const SUMMARY = {
  displayName: 'Ada',
  joined: '2026-07-01T00:00:00Z',
  testsStarted: 3,
  testsCompleted: 2,
  restartsPerCompleted: 0.5,
  timeTypingMs: 30000,
  estimatedWordsTyped: 96,
  wpm: { highest: 113, average: 108, averageLast10: 108 },
  raw: { highest: 118, average: 112, averageLast10: 112 },
  acc: { highest: 1, average: 0.97, averageLast10: 0.97 },
  consistency: { highest: 0.83, average: 0.79, averageLast10: 0.79 },
  streak: { current: 1, best: 4 },
  languages: [{ lang: 'german', tests: 2 }]
}

async function mountPage(name = 'Ada') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/boards', name: 'boards', component: { template: '<div />' } },
      { path: '/replay/:runId', name: 'replay', component: { template: '<div />' } },
      { path: '/u/:name', name: 'user', component: UserPage }
    ]
  })
  await router.push(`/u/${name}`)
  const wrapper = mount(UserPage, {
    global: {
      plugins: [
        i18n,
        router,
        createPinia(),
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false, gcTime: 0 } }
            })
          }
        ]
      ]
    }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of [
    h.header,
    h.summary,
    h.activity,
    h.pbs,
    h.histogram,
    h.timeseries,
    h.portrait,
    h.me,
    h.fetchQuery
  ]) {
    fn.mockReset()
  }
  h.fetchQuery.mockResolvedValue({ runs: [], nextCursor: undefined })
})

describe('/u/{name} — the closed profile state', () => {
  it('renders nick + closed state and NO data section, and never asks for data', async () => {
    h.header.mockResolvedValue({ name: 'Ada', joined: '2026-07-01T00:00:00Z', public: false })
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="user-closed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-closed-nick"]').text()).toBe('Ada')
    expect(wrapper.text()).toContain('closed by its owner')

    // Not one data section in the DOM…
    expect(wrapper.find('[data-testid^="profile-section-"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-runs"]').exists()).toBe(false)
    // …and, stronger: not one data request left the page. The server would
    // refuse them anyway (403 profile_closed) — the client just does not knock.
    expect(h.summary).not.toHaveBeenCalled()
    expect(h.activity).not.toHaveBeenCalled()
    expect(h.pbs).not.toHaveBeenCalled()
    expect(h.histogram).not.toHaveBeenCalled()
    expect(h.timeseries).not.toHaveBeenCalled()
    expect(h.portrait).not.toHaveBeenCalled()
    expect(h.fetchQuery).not.toHaveBeenCalled()
  })

  it('an unknown name is the 404 state, not the closed one', async () => {
    h.header.mockRejectedValue(new h.MockApiError(404, 'not_found'))
    const wrapper = await mountPage('nobody')

    expect(wrapper.find('[data-testid="user-not-found"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-closed"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('no player is called')
  })
})

describe('/u/{name} — the open profile', () => {
  beforeEach(() => {
    h.header.mockResolvedValue({ name: 'Ada', joined: '2026-07-01T00:00:00Z', public: true })
    h.summary.mockResolvedValue(SUMMARY)
    h.activity.mockResolvedValue({ days: [] })
    h.pbs.mockResolvedValue({ pbs: [] })
    h.histogram.mockResolvedValue({ buckets: [] })
    h.timeseries.mockResolvedValue({ days: [], wpmPerHour: 0 })
  })

  it('renders the sections read-only: identity, no race actions, public runs feed', async () => {
    h.portrait.mockRejectedValue(new h.MockApiError(403, 'portrait_closed'))
    h.fetchQuery.mockResolvedValue({
      runs: [
        {
          id: 'r1',
          mode: 'time',
          durationMs: 15000,
          wordCount: null,
          lang: 'german',
          serverMetrics: { wpm: 103.2, accuracy: 0.97 },
          serverScore: { total: 2864 },
          createdAt: '2026-07-28T10:00:00Z',
          status: 'accepted',
          grade: 'S',
          consistency: 0.76,
          chars: { correct: 240, incorrect: 5, extra: 2, missed: 1 },
          quoteId: null,
          adoptedFromRunId: null,
          mods: { punctuation: false, difficulty: 'normal', minWpm: 0 }
        }
      ],
      nextCursor: undefined
    })
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="profile-nick"]').text()).toBe('Ada')
    expect(wrapper.find('[data-testid="profile-section-runs"]').exists()).toBe(true)

    // The table fetched the PUBLIC feed, keyed by the name.
    expect(h.fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['users', 'Ada', 'runs', null] })
    )
    // Replay is offered where the server serves it (every public row is
    // accepted); the race action does not exist on a read-only table.
    expect(wrapper.find('[data-testid="profile-run-replay"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-run-race"]').exists()).toBe(false)
  })

  it('renders 403 portrait_closed as the "kept private" note, not an error', async () => {
    h.portrait.mockRejectedValue(new h.MockApiError(403, 'portrait_closed'))
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="user-portrait-closed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-error-keyboard"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('kept private by its owner')
  })
})
