import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'

import en from '@/app/i18n/locales/en'

// The table talks to the server through the query cache; the cache is the mock
// boundary, exactly like the submission hook's tests treat @shared/api.
//
// A QUOTE row additionally resolves its text through `GET /quotes/{id}` (the
// public, immutable, cached-by-id read the quote board's heading also uses), so
// the mock carries that query's options too and the mount installs a real
// vue-query client for it to run against.
const h = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  quotes: new Map<string, unknown>(),
  pages: [] as unknown[]
}))

vi.mock('@shared/api', () => ({
  queryClient: { fetchQuery: h.fetchQuery },
  runsQueryOptions: (cursor?: string) => ({ queryKey: ['runs', cursor ?? null] }),
  quoteByIdQueryOptions: (id: string) => ({
    queryKey: ['quote', id],
    queryFn: () => Promise.resolve(h.quotes.get(id))
  })
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

const mountTable = () =>
  mount(ProfileRunsTable, {
    global: {
      plugins: [
        i18n,
        router,
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

beforeEach(() => {
  h.fetchQuery.mockReset()
  h.quotes.clear()
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

  /**
   * A quote run has NEITHER a duration nor a word count by contract — its
   * length is the quote's — so the cell that would hold "50 words" holds the
   * quote instead: the text, truncated, over its length band.
   */
  it('shows a quote run`s text and length band in place of a size, linked to its board', async () => {
    h.quotes.set('q-1', {
      id: 'q-1',
      lang: 'english',
      source: 'Aesop',
      text: 'the quick brown fox jumps over the lazy dog',
      length: 43,
      lenGroup: 'medium'
    })
    h.fetchQuery.mockResolvedValueOnce({
      runs: [run('r2', { wordCount: null, mode: 'quote', quoteId: 'q-1' })],
      nextCursor: undefined
    })
    const wrapper = mountTable()
    await flushPromises()

    const link = wrapper.find('[data-testid="profile-run-quote-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('bucket=quote:q-1')
    expect(wrapper.find('[data-testid="profile-run-quote-text"]').text()).toBe(
      'the quick brown fox jumps over the lazy dog'
    )
    expect(wrapper.find('[data-testid="profile-run-quote-group"]').text()).toBe('medium')

    // The size a seeded row would show must NOT be there — the two are
    // alternatives, not a column that gained a second value.
    const row = wrapper.find('[data-testid="profile-run-row"]')
    expect(row.text()).not.toContain('words')
  })

  /**
   * The row still draws when the quote does not resolve. The ranking, the grade
   * and the link do not depend on the text, so an unresolvable id degrades to
   * the word "quote" rather than to an error or an empty cell.
   */
  it('falls back to the word `quote` when the text cannot be resolved', async () => {
    h.fetchQuery.mockResolvedValueOnce({
      runs: [run('r2', { wordCount: null, mode: 'quote', quoteId: 'q-gone' })],
      nextCursor: undefined
    })
    const wrapper = mountTable()
    await flushPromises()
    expect(wrapper.find('[data-testid="profile-run-quote-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-run-quote-text"]').text()).toBe('quote')
  })

  /**
   * Saved is not counted. A run whose text was adopted from another run is
   * stored, judged and listed — and holds no board slot, no PB and no rating
   * point. The row is the only place that fact survives past the results
   * screen, so it says so.
   */
  it('marks a run whose text came from another run as not counted', async () => {
    h.fetchQuery.mockResolvedValueOnce({
      runs: [run('r4', { adoptedFromRunId: 'r1' }), run('r1')],
      nextCursor: undefined
    })
    const wrapper = mountTable()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="profile-run-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].find('[data-testid="profile-run-not-counted"]').text()).toBe('not counted')
    expect(rows[1].find('[data-testid="profile-run-not-counted"]').exists()).toBe(false)
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
