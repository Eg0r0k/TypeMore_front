/**
 * `/boards` as a whole: the catalogue's three distinct outcomes, and the rule
 * that a broken BOARD must never cost the user the picker they would use to
 * leave it.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { BucketInfo } from '@shared/api'
import { i18n } from '@app/i18n'
import { ROUTE_NAMES } from '@/app/router/route-names'

const h = vi.hoisted(() => ({
  catalogue: vi.fn(),
  page: vi.fn(),
  me: vi.fn(),
  quote: vi.fn()
}))

vi.mock('@shared/api', () => {
  class ApiError extends Error {
    status: number
    code: string
    constructor(shape: { status: number; code: string; message?: string }) {
      super(shape.message ?? shape.code)
      this.status = shape.status
      this.code = shape.code
    }
  }
  return {
    ApiError,
    isApiError: (value: unknown) => value instanceof ApiError,
    // Pure predicate, so the mock carries the real rule rather than a stub: the
    // rail's derivations call it for every row and a missing export throws
    // inside render.
    isQuoteBucket: (bucket: object) => 'quoteId' in bucket,
    // The length-filter guard reads the real schema's options.
    QuoteLengthGroupSchema: { options: ['short', 'medium', 'long', 'thicc'] },
    // The real factory `select`s `.buckets` out of the envelope; the view only
    // ever sees the array, so that is what the mock resolves.
    bucketCatalogueQueryOptions: () => ({
      queryKey: ['catalogue'],
      queryFn: () => h.catalogue()
    }),
    // The rail asks the dictionary catalogue what a bucket's language is
    // CALLED. This harness publishes none, so every board falls back to its key
    // — which is what the label assertions below read.
    dictionaryCatalogueQueryOptions: () => ({
      queryKey: ['dictionaries'],
      queryFn: () => []
    }),
    languageNamesQueryOptions: () => ({
      queryKey: ['language-names'],
      queryFn: () => ({})
    }),
    boardPageQueryOptions: (bucket: string, cursor?: string) => ({
      queryKey: ['board', bucket, cursor ?? ''],
      queryFn: () => h.page(bucket, cursor)
    }),
    boardMeQueryOptions: (bucket: string) => ({
      queryKey: ['board', bucket, 'me'],
      queryFn: () => h.me(bucket)
    }),
    // The quote board's heading resolves its own text by id.
    quoteByIdQueryOptions: (id: string) => ({
      queryKey: ['quote', id],
      queryFn: () => h.quote(id)
    })
  }
})

import { ApiError } from '@shared/api'
import { BoardsPage } from '@/pages/boards'

const TIME_15: BucketInfo = {
  bucket: 'time:15000:en:seeded',
  mode: 'time',
  durationMs: 15_000,
  lang: 'en',
  textSource: 'seeded',
  entries: 3
}

const WORDS_25: BucketInfo = {
  bucket: 'words:25:ru-RU:seeded',
  mode: 'words',
  wordCount: 25,
  lang: 'ru-RU',
  textSource: 'seeded',
  entries: 11
}

/**
 * A quote board, deliberately the BUSIEST row in the catalogue: the picker must
 * skip it for being a quote board, not for being small.
 */
const QUOTE_ID = '0a6c0103-89c8-43be-bd66-1371216d4a53'
const QUOTE_BOARD: BucketInfo = {
  bucket: `quote:${QUOTE_ID}`,
  quoteId: QUOTE_ID,
  entries: 99
}

let router: Router
let queryClient: QueryClient

const settle = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const mountPage = async () => {
  const wrapper = mount(BoardsPage, {
    global: { plugins: [i18n, router, [VueQueryPlugin, { queryClient }]] }
  })
  await settle()
  return wrapper
}

beforeEach(async () => {
  h.catalogue.mockReset()
  h.page.mockReset()
  h.me.mockReset()
  h.page.mockResolvedValue({ bucket: WORDS_25.bucket, entries: [] })
  h.me.mockRejectedValue(new ApiError({ status: 401, code: 'unauthorized' }))
  h.quote.mockResolvedValue({
    id: QUOTE_ID,
    lang: 'russian',
    source: 'Собачье сердце',
    text: 'Лаской-с. Единственным способом, который возможен в обращении с живым существом.'
  })
  i18n.global.locale.value = 'en'
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
  })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/boards', name: ROUTE_NAMES.BOARDS, component: { template: '<div />' } },
      { path: '/replay/:runId', name: ROUTE_NAMES.REPLAY, component: { template: '<div />' } }
    ]
  })
  await router.push('/boards')
  await router.isReady()
})

describe('boards page', () => {
  it('treats an empty catalogue as an answer, not a failure', async () => {
    h.catalogue.mockResolvedValue([])

    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="boards-no-boards"]').text()).toBe(
      i18n.global.t('boards.noBoards')
    )
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="boards-retry"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rail-languages"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(i18n.global.t('boards.loading'))

    wrapper.unmount()
  })

  it('offers a retry when the catalogue itself fails, and recovers on it', async () => {
    h.catalogue.mockRejectedValueOnce(new Error('offline'))

    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="boards-error"]').text()).toBe(i18n.global.t('boards.error'))
    expect(wrapper.find('[data-testid="rail-languages"]').exists()).toBe(false)

    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])
    await wrapper.get('[data-testid="boards-retry"]').trigger('click')
    await settle()

    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rail-languages"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('lands on the busiest board, and the rail marks its language and variation', async () => {
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])

    const wrapper = await mountPage()

    // WORDS_25 has 11 entries against TIME_15's 3.
    expect(h.page).toHaveBeenCalledWith(WORDS_25.bucket, undefined)
    const activeLanguage = wrapper.get('[data-testid="rail-language"].board-rail__item--active')
    expect(activeLanguage.text()).toContain('ru-RU')
    const activeVariation = wrapper.get('[data-testid="rail-variation"].board-rail__item--active')
    expect(activeVariation.text()).toContain('25 words')

    wrapper.unmount()
  })

  it('keeps the rail when the board fails, so another board is one click away', async () => {
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])
    h.page.mockRejectedValue(new Error('board is down'))

    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="boards-error"]').text()).toBe(
      i18n.global.t('boards.pageError')
    )
    // The whole point: a dead board is not a dead page.
    expect(wrapper.find('[data-testid="rail-languages"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="boards-retry"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('shows the loading state while the catalogue is in flight, and no error with it', async () => {
    // Never settles: the catalogue stays in flight for the whole assertion.
    h.catalogue.mockReturnValue(Promise.withResolvers<BucketInfo[]>().promise)

    const wrapper = mount(BoardsPage, {
      global: { plugins: [i18n, router, [VueQueryPlugin, { queryClient }]] }
    })
    await nextTick()

    expect(wrapper.text()).toContain(i18n.global.t('boards.loading'))
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="boards-no-boards"]').exists()).toBe(false)

    wrapper.unmount()
  })

  /**
   * There is one quote board per quote and the corpus is ~15 800 of them, so
   * they are not browsable and are not offered. The two halves of that decision
   * are asserted separately, because getting one right and the other wrong is
   * exactly how this breaks: unlisted must not mean unreachable.
   */
  it('never lands on a quote board, however busy it is', async () => {
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25, QUOTE_BOARD])

    const wrapper = await mountPage()

    // QUOTE_BOARD has 99 entries against WORDS_25's 11 and would win on count
    // alone. It is skipped for being a quote board.
    expect(h.page).toHaveBeenCalledWith(WORDS_25.bucket, undefined)
    expect(wrapper.text()).not.toContain(QUOTE_ID)
    expect(wrapper.find('[data-testid="quote-board-header"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('still resolves a shared quote link, and names the quote instead of the uuid', async () => {
    await router.push(`/boards?bucket=${QUOTE_BOARD.bucket}`)
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25, QUOTE_BOARD])

    const wrapper = await mountPage()

    expect(h.page).toHaveBeenCalledWith(QUOTE_BOARD.bucket, undefined)

    // The heading is the TEXT, not the id — that is the whole complaint the
    // per-quote board had against it.
    const header = wrapper.get('[data-testid="quote-board-header"]')
    expect(header.text()).toContain('Лаской-с')
    expect(header.text()).toContain('Собачье сердце')
    expect(header.text()).not.toContain(QUOTE_ID)

    // The rail stays: it is how every other board is reached from here.
    expect(wrapper.find('[data-testid="rail-languages"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('honours a shared ?bucket= over the busiest board', async () => {
    await router.push(`/boards?bucket=${TIME_15.bucket}`)
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])

    const wrapper = await mountPage()

    const activeVariation = wrapper.get('[data-testid="rail-variation"].board-rail__item--active')
    expect(activeVariation.text()).toContain('15s')
    expect(h.page).toHaveBeenCalledWith(TIME_15.bucket, undefined)

    wrapper.unmount()
  })

  it('lists only real presets, muting the ones this language has no board for', async () => {
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])

    const wrapper = await mountPage()

    // The catalogue holds exactly two shapes across all languages — time:15
    // and words:25 — so exactly two chips render: no invented 30s/60s/50/100.
    const chips = wrapper.findAll('[data-testid="rail-variation"]')
    expect(chips.map((chip) => chip.text())).toEqual(['15s0', '25 words11'])

    // The busiest board is ru-RU words:25; ru-RU has no 15s board, so that
    // chip is muted, disabled, and shows its zero count.
    const muted = chips[0]
    expect(muted.classes()).toContain('board-rail__item--muted')
    expect(muted.attributes('disabled')).toBeDefined()

    wrapper.unmount()
  })
})
