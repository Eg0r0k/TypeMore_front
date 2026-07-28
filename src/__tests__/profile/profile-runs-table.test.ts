import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'

import en from '@/app/i18n/locales/en'

// The table talks to the server through the query cache; the cache is the mock
// boundary, exactly like the submission hook's tests treat @shared/api.
const h = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  pages: [] as unknown[]
}))

vi.mock('@shared/api', () => ({
  queryClient: { fetchQuery: h.fetchQuery },
  runsQueryOptions: (cursor?: string) => ({ queryKey: ['runs', cursor ?? null] })
}))

import { ProfileRunsTable } from '@/features/profile'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/boards', name: 'boards', component: { template: '<div />' } }
  ]
})

const run = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  mode: 'words',
  durationMs: null,
  wordCount: 50,
  lang: 'german',
  seed: 1,
  dictHash: 'x',
  setup: {},
  clientMetrics: {},
  clientScore: {},
  scoreVersion: 2,
  status: 'accepted',
  serverMetrics: { wpm: 103.2, accuracy: 0.97 },
  logBytes: 100,
  restartsSinceLastSubmit: 0,
  createdAt: '2026-07-28T10:00:00Z',
  grade: 'S',
  consistency: 0.76,
  chars: { correct: 240, incorrect: 5, extra: 2, missed: 1 },
  quoteId: null,
  mods: { punctuation: true, difficulty: 'expert', minWpm: 0 },
  ...over
})

const mountTable = () => mount(ProfileRunsTable, { global: { plugins: [i18n, router] } })

beforeEach(() => {
  h.fetchQuery.mockReset()
})

describe('profile runs table — derived cells and keyset load-more', () => {
  it('renders the derived cells: grade, consistency, chars, mode detail, mods slice', async () => {
    h.fetchQuery.mockResolvedValueOnce({ runs: [run('r1')], nextCursor: undefined })
    const wrapper = mountTable()
    await flushPromises()

    const row = wrapper.find('[data-testid="profile-run-row"]')
    expect(row.text()).toContain('50 words')
    expect(row.text()).toContain('german')
    expect(row.text()).toContain('103.2')
    expect(row.find('[data-testid="profile-run-consistency"]').text()).toBe('76%')
    expect(row.find('[data-testid="profile-run-chars"]').text()).toBe('240/5/2/1')
    expect(row.text()).toContain('S')
    expect(row.text()).toContain('punctuation · expert')
  })

  it('links a quote run to its quote board', async () => {
    h.fetchQuery.mockResolvedValueOnce({
      runs: [run('r2', { wordCount: null, mode: 'quote', quoteId: 'q-1' })],
      nextCursor: undefined
    })
    const wrapper = mountTable()
    await flushPromises()
    const link = wrapper.find('[data-testid="profile-run-quote-link"]')
    expect(link.exists()).toBe(true)
  })

  it('load-more continues the keyset and appends', async () => {
    h.fetchQuery
      .mockResolvedValueOnce({ runs: [run('r1')], nextCursor: 'cur-1' })
      .mockResolvedValueOnce({ runs: [run('r2')], nextCursor: undefined })
    const wrapper = mountTable()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="profile-run-row"]')).toHaveLength(1)

    await wrapper.find('[data-testid="profile-runs-more"]').trigger('click')
    await flushPromises()
    expect(h.fetchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryKey: ['runs', 'cur-1'] })
    )
    expect(wrapper.findAll('[data-testid="profile-run-row"]')).toHaveLength(2)
    // The last page: the button leaves.
    expect(wrapper.find('[data-testid="profile-runs-more"]').exists()).toBe(false)
  })

  it('a pending run shows its status instead of a grade, and no actions', async () => {
    h.fetchQuery.mockResolvedValueOnce({
      runs: [
        run('r3', {
          status: 'pending',
          serverMetrics: null,
          grade: null,
          consistency: null,
          chars: null
        })
      ],
      nextCursor: undefined
    })
    const wrapper = mountTable()
    await flushPromises()
    const row = wrapper.find('[data-testid="profile-run-row"]')
    expect(row.text()).toContain('pending')
    expect(row.find('[data-testid="profile-run-race"]').exists()).toBe(false)
  })

  it('renders the empty state when the feed is empty', async () => {
    h.fetchQuery.mockResolvedValueOnce({ runs: [], nextCursor: undefined })
    const wrapper = mountTable()
    await flushPromises()
    expect(wrapper.find('[data-testid="profile-runs-empty"]').exists()).toBe(true)
  })
})
