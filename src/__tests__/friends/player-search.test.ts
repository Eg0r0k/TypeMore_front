/**
 * The player-search box on /friends.
 *
 * The API layer is the mock boundary, so the tests assert not only what
 * rendered but what was ASKED — the server's `q` bounds are mirrored client
 * side precisely so a query it would refuse never leaves the browser, and a
 * rate-limited endpoint must not see one request per keystroke.
 *
 * The rules under test are the server's, not this component's: 3–20 characters,
 * no cursor, and closed profiles present in the results. See `searchUsers`.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import en from '@/app/i18n/locales/en'

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
  return { MockApiError, search: vi.fn() }
})

vi.mock('@shared/api', async () => {
  // `keepPreviousData` is carried over from the real factory rather than
  // dropped: it is what holds the previous hits on screen while a refinement
  // lands, and a mock without it would quietly make that assertion vacuous.
  const { keepPreviousData } = await import('@tanstack/vue-query')
  return {
    isApiError: (value: unknown): boolean => value instanceof h.MockApiError,
    // The REAL bounds, not a stub: the gate is the thing being tested, so a
    // permissive fake would make every assertion below vacuous too.
    SEARCH_MIN_QUERY_LEN: 3,
    SEARCH_MAX_QUERY_LEN: 20,
    isSearchable: (query: string): boolean => {
      const length = [...query.trim()].length
      return length >= 3 && length <= 20
    },
    userSearchQueryOptions: (query: string) => ({
      queryKey: ['users', 'search', query.trim()],
      queryFn: () => h.search(query),
      placeholderData: keepPreviousData,
      retry: false
    })
  }
})

const { PlayerSearch } = await import('@/features/friends/player-search')

const hit = (name: string, isPublic = true) => ({
  name,
  joined: '2025-03-14T10:00:00Z',
  public: isPublic
})

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/u/:name', name: 'user', component: { template: '<div />' } }
  ]
})

function mountSearch() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  return mount(PlayerSearch, {
    global: {
      plugins: [
        router,
        i18n,
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]
      ]
    }
  })
}

/** Type into the box and let the debounce elapse. */
async function type(wrapper: ReturnType<typeof mountSearch>, value: string): Promise<void> {
  await wrapper.find('input').setValue(value)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

describe('player search', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.search.mockReset()
    h.search.mockResolvedValue({ users: [] })
  })
  afterEach(() => vi.useRealTimers())

  // The server answers a shorter `q` with a 400, and below three characters a
  // trigram index cannot serve the query at all — so the box must not ask.
  it('does not query below the minimum length, and says why', async () => {
    const wrapper = mountSearch()

    await type(wrapper, 'bo')

    expect(h.search).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="player-search-status"]').text()).toContain(
      'at least 3 characters'
    )
  })

  it('queries once the query is long enough', async () => {
    const wrapper = mountSearch()
    h.search.mockResolvedValue({ users: [hit('bobby'), hit('bobcat')] })

    await type(wrapper, 'bob')

    expect(h.search).toHaveBeenCalledTimes(1)
    expect(h.search).toHaveBeenCalledWith('bob')
    const names = wrapper.findAll('[data-testid="player-search-hit"]').map((el) => el.text())
    expect(names[0]).toContain('bobby')
    expect(names[1]).toContain('bobcat')
  })

  // The endpoint is rate-limited and every keystroke is a fresh cache key.
  it('debounces: typing a whole name is one request, not one per letter', async () => {
    const wrapper = mountSearch()
    const input = wrapper.find('input')

    for (const value of ['b', 'bo', 'bob', 'bobb', 'bobby']) {
      await input.setValue(value)
      await vi.advanceTimersByTimeAsync(40) // faster than the debounce window
    }
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(h.search).toHaveBeenCalledTimes(1)
    expect(h.search).toHaveBeenCalledWith('bobby')
  })

  // A hit is a link to the profile page, which is the whole point of the box.
  it('links every hit to its public profile', async () => {
    const wrapper = mountSearch()
    h.search.mockResolvedValue({ users: [hit('bobby')] })

    await type(wrapper, 'bob')

    expect(wrapper.get('[data-testid="player-search-hit"]').attributes('href')).toBe('/u/bobby')
  })

  // The server lists closed profiles ON PURPOSE — finding a profile is never a
  // second way to read one. Filtering them here would tell a player looking for
  // someone who closed their profile that nobody by that name exists, which is
  // the worst answer a search box can give.
  it('lists a closed profile, marked and still linked', async () => {
    const wrapper = mountSearch()
    h.search.mockResolvedValue({ users: [hit('quiet', false)] })

    await type(wrapper, 'qui')

    const row = wrapper.get('[data-testid="player-search-hit"]')
    expect(row.attributes('href')).toBe('/u/quiet')
    expect(wrapper.get('[data-testid="player-search-closed"]').text()).toBe('closed')
  })

  it('answers an empty result with nobody, naming the query', async () => {
    const wrapper = mountSearch()

    await type(wrapper, 'zzz')

    expect(wrapper.find('[data-testid="player-search-results"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="player-search-status"]').text()).toContain('zzz')
  })

  it('surfaces a failed search instead of showing it as empty', async () => {
    const wrapper = mountSearch()
    h.search.mockRejectedValue(new h.MockApiError(500, 'internal'))

    await type(wrapper, 'bob')

    expect(wrapper.get('[data-testid="player-search-status"]').text()).toContain('internal')
  })

  // Hits stay on screen, dimmed, while a refinement is in flight: blanking the
  // list on every keystroke is what makes a search box feel broken.
  it('keeps the previous hits while a refined query is in flight', async () => {
    const wrapper = mountSearch()
    h.search.mockResolvedValue({ users: [hit('bobby')] })
    await type(wrapper, 'bob')

    let release: (value: { users: unknown[] }) => void = () => {}
    h.search.mockReturnValue(new Promise((resolve) => (release = resolve)))
    await wrapper.find('input').setValue('bobb')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const results = wrapper.get('[data-testid="player-search-results"]')
    expect(results.text()).toContain('bobby')
    expect(results.attributes('aria-busy')).toBe('true')

    release({ users: [] })
    await flushPromises()
  })
})
