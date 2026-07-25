/**
 * The ranking itself: what a row shows, what each state offers, how paging
 * accumulates, and where a row click goes.
 *
 * `@shared/api` is mocked at the module level — these tests are about the view's
 * behaviour against the contract's SHAPES, not about transport.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { BoardEntry, BoardMods, BoardPage } from '@shared/api'
import { i18n } from '@app/i18n'
import { ROUTE_NAMES } from '@/app/router/route-names'

const h = vi.hoisted(() => ({ page: vi.fn() }))

vi.mock('@shared/api', () => ({
  // One cache entry per (bucket, cursor) — exactly what the real factory does.
  boardPageQueryOptions: (bucket: string, cursor?: string) => ({
    queryKey: ['board', bucket, cursor ?? ''],
    queryFn: () => h.page(bucket, cursor)
  })
}))

import { BoardTable } from '@/features/leaderboards'

const BUCKET = 'time:15000:en:seeded'

const PLAIN: BoardMods = {
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  nospace: false,
  difficulty: 'normal',
  minWpm: 0,
  blind: false,
  fading: false,
  flashlight: false
}

const entry = (over: Partial<BoardEntry> = {}): BoardEntry => ({
  rank: 1,
  userId: 'user-1',
  displayName: 'boardsmoke',
  score: 2864,
  wpm: 83.24464940286154,
  raw: 83.24464940286154,
  acc: 1,
  grade: 'SS',
  mods: PLAIN,
  runId: 'run-1',
  achievedAt: '2026-07-25T13:43:14.772724Z',
  ...over
})

const page = (entries: BoardEntry[], nextCursor?: string): BoardPage => ({
  bucket: BUCKET,
  entries,
  ...(nextCursor === undefined ? {} : { nextCursor })
})

let router: Router
let queryClient: QueryClient

const settle = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const mountTable = async (props: { bucket: string; selfUserId?: string }) => {
  const wrapper = mount(BoardTable, {
    props,
    global: { plugins: [i18n, router, [VueQueryPlugin, { queryClient }]] }
  })
  await settle()
  return wrapper
}

const rowTexts = (wrapper: VueWrapper, testid: string): string[] =>
  wrapper.findAll(`[data-testid="${testid}"]`).map((node) => node.text())

beforeEach(async () => {
  h.page.mockReset()
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

describe('board table', () => {
  it('renders one row per entry with the server’s numbers formatted for display', async () => {
    h.page.mockResolvedValue(
      page([
        entry({ rank: 1, score: 2864, wpm: 83.24464940286154, acc: 1 }),
        entry({
          rank: 2,
          userId: 'user-2',
          displayName: 'runner-up',
          runId: 'run-2',
          score: 2401.6,
          wpm: 71.5,
          acc: 0.9712
        })
      ])
    )

    const wrapper = await mountTable({ bucket: BUCKET })

    expect(wrapper.findAll('[data-testid="boards-row"]')).toHaveLength(2)
    expect(rowTexts(wrapper, 'boards-rank')).toEqual(['1', '2'])
    expect(rowTexts(wrapper, 'boards-player')).toEqual(['boardsmoke', 'runner-up'])
    expect(rowTexts(wrapper, 'boards-score')).toEqual(['2864', '2402'])

    wrapper.unmount()
  })

  it('renders acc as a percentage of the fraction the wire carries', async () => {
    h.page.mockResolvedValue(
      page([entry({ acc: 0.9712 }), entry({ userId: 'u2', runId: 'r2', acc: 1 })])
    )

    const wrapper = await mountTable({ bucket: BUCKET })

    // 0.9712 is 97%, not "0.9712" and not "9712%".
    expect(wrapper.text()).toContain('97%')
    expect(wrapper.text()).toContain('100%')
    expect(wrapper.text()).not.toContain('0.9712')

    wrapper.unmount()
  })

  it('offers each row as a real button named after whose run it plays back', async () => {
    h.page.mockResolvedValue(page([entry({ displayName: 'boardsmoke' })]))

    const wrapper = await mountTable({ bucket: BUCKET })
    const watch = wrapper.get('[data-testid="boards-watch"]')

    expect(watch.element.tagName).toBe('BUTTON')
    expect(watch.attributes('aria-label')).toBe(
      i18n.global.t('boards.watch', { player: 'boardsmoke' })
    )

    wrapper.unmount()
  })

  it('navigates to the run’s replay, carrying the bucket for the way back', async () => {
    h.page.mockResolvedValue(page([entry({ runId: 'run-42' })]))

    const wrapper = await mountTable({ bucket: BUCKET })
    const push = vi.spyOn(router, 'push')

    await wrapper.get('[data-testid="boards-watch"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: ROUTE_NAMES.REPLAY,
      params: { runId: 'run-42' },
      query: { bucket: BUCKET }
    })

    wrapper.unmount()
  })

  it('marks the caller’s own row and no other', async () => {
    h.page.mockResolvedValue(
      page([
        entry({ rank: 1, userId: 'them', displayName: 'someone', runId: 'r1' }),
        entry({ rank: 2, userId: 'me', displayName: 'myself', runId: 'r2' })
      ])
    )

    const wrapper = await mountTable({ bucket: BUCKET, selfUserId: 'me' })
    const players = rowTexts(wrapper, 'boards-player')

    expect(players[0]).not.toContain(i18n.global.t('boards.you'))
    expect(players[1]).toContain(i18n.global.t('boards.you'))

    wrapper.unmount()
  })

  it('says the board is empty rather than showing an error for a page with no entries', async () => {
    h.page.mockResolvedValue(page([]))

    const wrapper = await mountTable({ bucket: BUCKET })

    expect(wrapper.get('[data-testid="boards-empty"]').text()).toBe(i18n.global.t('boards.empty'))
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="boards-row"]')).toHaveLength(0)

    wrapper.unmount()
  })

  it('offers a retry that refetches after a failed page, and is not the empty state', async () => {
    h.page.mockRejectedValueOnce(new Error('boom'))

    const wrapper = await mountTable({ bucket: BUCKET })

    expect(wrapper.get('[data-testid="boards-error"]').text()).toBe(
      i18n.global.t('boards.pageError')
    )
    expect(wrapper.find('[data-testid="boards-empty"]').exists()).toBe(false)

    h.page.mockResolvedValue(page([entry({ displayName: 'after-retry' })]))
    await wrapper.get('[data-testid="boards-retry"]').trigger('click')
    await settle()

    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(rowTexts(wrapper, 'boards-player')).toEqual(['after-retry'])

    wrapper.unmount()
  })

  it('appends the next keyset page instead of replacing the current one', async () => {
    h.page.mockImplementation((_bucket: string, cursor?: string) =>
      Promise.resolve(
        cursor === undefined
          ? page([entry({ rank: 1, userId: 'a', displayName: 'first', runId: 'r1' })], 'CURSOR-2')
          : page([entry({ rank: 2, userId: 'b', displayName: 'second', runId: 'r2' })])
      )
    )

    const wrapper = await mountTable({ bucket: BUCKET })
    expect(rowTexts(wrapper, 'boards-player')).toEqual(['first'])

    await wrapper.get('[data-testid="boards-more"]').trigger('click')
    await settle()

    expect(rowTexts(wrapper, 'boards-player')).toEqual(['first', 'second'])
    expect(h.page).toHaveBeenLastCalledWith(BUCKET, 'CURSOR-2')
    // Last page: forward-only paging has nothing further to offer.
    expect(wrapper.find('[data-testid="boards-more"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('offers no load-more when the first page is already the last', async () => {
    h.page.mockResolvedValue(page([entry()]))

    const wrapper = await mountTable({ bucket: BUCKET })

    expect(wrapper.find('[data-testid="boards-more"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('drops the accumulation when the bucket changes', async () => {
    const OTHER = 'words:25:en:seeded'
    h.page.mockImplementation((bucket: string, cursor?: string) =>
      Promise.resolve(
        bucket === BUCKET
          ? {
              bucket: BUCKET,
              entries: [entry({ displayName: 'old-board', runId: 'r1' })],
              ...(cursor === undefined ? { nextCursor: 'CURSOR-2' } : {})
            }
          : { bucket: OTHER, entries: [entry({ displayName: 'new-board', runId: 'r9' })] }
      )
    )

    const wrapper = await mountTable({ bucket: BUCKET })
    await wrapper.get('[data-testid="boards-more"]').trigger('click')
    await settle()
    expect(wrapper.findAll('[data-testid="boards-row"]')).toHaveLength(2)

    await wrapper.setProps({ bucket: OTHER })
    await settle()

    // Not "old rows plus new ones under new ranks".
    expect(rowTexts(wrapper, 'boards-player')).toEqual(['new-board'])

    wrapper.unmount()
  })
})
