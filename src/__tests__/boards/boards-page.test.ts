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

const h = vi.hoisted(() => ({ catalogue: vi.fn(), page: vi.fn(), me: vi.fn() }))

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
    // The real factory `select`s `.buckets` out of the envelope; the view only
    // ever sees the array, so that is what the mock resolves.
    bucketCatalogueQueryOptions: () => ({
      queryKey: ['catalogue'],
      queryFn: () => h.catalogue()
    }),
    boardPageQueryOptions: (bucket: string, cursor?: string) => ({
      queryKey: ['board', bucket, cursor ?? ''],
      queryFn: () => h.page(bucket, cursor)
    }),
    boardMeQueryOptions: (bucket: string) => ({
      queryKey: ['board', bucket, 'me'],
      queryFn: () => h.me(bucket)
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
    expect(wrapper.find('[data-testid="boards-bucket-picker"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(i18n.global.t('boards.loading'))

    wrapper.unmount()
  })

  it('offers a retry when the catalogue itself fails, and recovers on it', async () => {
    h.catalogue.mockRejectedValueOnce(new Error('offline'))

    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="boards-error"]').text()).toBe(i18n.global.t('boards.error'))
    expect(wrapper.find('[data-testid="boards-bucket-picker"]').exists()).toBe(false)

    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])
    await wrapper.get('[data-testid="boards-retry"]').trigger('click')
    await settle()

    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="boards-bucket-picker"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('lands on the busiest board and names it by the dimension its mode gives it', async () => {
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])

    const wrapper = await mountPage()

    // WORDS_25 has 11 entries against TIME_15's 3.
    expect(wrapper.get('[data-testid="boards-bucket-picker"]').text()).toContain('25 words')
    expect(h.page).toHaveBeenCalledWith(WORDS_25.bucket, undefined)

    wrapper.unmount()
  })

  it('keeps the picker when the board fails, so another board is one click away', async () => {
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])
    h.page.mockRejectedValue(new Error('board is down'))

    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="boards-error"]').text()).toBe(
      i18n.global.t('boards.pageError')
    )
    // The whole point: a dead board is not a dead page.
    expect(wrapper.find('[data-testid="boards-bucket-picker"]').exists()).toBe(true)
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

  it('honours a shared ?bucket= over the busiest board', async () => {
    await router.push(`/boards?bucket=${TIME_15.bucket}`)
    h.catalogue.mockResolvedValue([TIME_15, WORDS_25])

    const wrapper = await mountPage()

    expect(wrapper.get('[data-testid="boards-bucket-picker"]').text()).toContain('15s')
    expect(h.page).toHaveBeenCalledWith(TIME_15.bucket, undefined)

    wrapper.unmount()
  })
})
