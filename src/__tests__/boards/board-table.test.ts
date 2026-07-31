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
import { groupThousands } from '@/shared/lib/helpers/numbers'
import { ROUTE_NAMES } from '@/app/router/route-names'

const h = vi.hoisted(() => ({ page: vi.fn(), before: vi.fn(), around: vi.fn() }))

vi.mock('@shared/api', () => ({
  // One cache entry per (bucket, cursor) — exactly what the real factories do.
  boardPageQueryOptions: (bucket: string, cursor?: string) => ({
    queryKey: ['board', bucket, cursor ?? ''],
    queryFn: () => h.page(bucket, cursor)
  }),
  boardPageBeforeQueryOptions: (bucket: string, before: string) => ({
    queryKey: ['board', bucket, 'before', before],
    queryFn: () => h.before(bucket, before)
  }),
  boardAroundQueryOptions: (bucket: string) => ({
    queryKey: ['board', bucket, 'around'],
    queryFn: () => h.around(bucket)
  })
}))

// The feed reads through the app-wide client (`queryClient.fetchQuery`), whose
// production defaults retry 5xx with backoff; tests want one fetch per ask.
vi.mock('@/shared/api/query-client', async () => {
  const { QueryClient: TestClient } = await import('@tanstack/vue-query')
  return {
    queryClient: new TestClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
    })
  }
})

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
  h.before.mockReset()
  h.around.mockReset()
  i18n.global.locale.value = 'en'
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
  })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/boards', name: ROUTE_NAMES.BOARDS, component: { template: '<div />' } },
      { path: '/replay/:runId', name: ROUTE_NAMES.REPLAY, component: { template: '<div />' } },
      { path: '/race/:runId', name: ROUTE_NAMES.RACE, component: { template: '<div />' } }
    ]
  })
  await router.push('/boards')
  await router.isReady()
})

describe('board table', () => {
  it('renders one row per entry with the server’s numbers formatted for display', async () => {
    h.page.mockResolvedValue(
      page([
        entry({ rank: 1, score: 2864, wpm: 83.24464940286154, raw: 90.4, acc: 1 }),
        entry({
          rank: 2,
          userId: 'user-2',
          displayName: 'runner-up',
          runId: 'run-2',
          score: 2401.6,
          wpm: 71.5,
          raw: 77.2,
          acc: 0.9712,
          grade: 'A'
        })
      ])
    )

    const wrapper = await mountTable({ bucket: BUCKET })

    expect(wrapper.findAll('[data-testid="boards-row"]')).toHaveLength(2)
    expect(rowTexts(wrapper, 'boards-rank')).toEqual(['1', '2'])
    expect(rowTexts(wrapper, 'boards-player')).toEqual(['boardsmoke', 'runner-up'])
    // Score carries the grade BADGE beside the value — neither owns a column.
    // Badge first, value after: the redesigned cell leads with the grade, the
    // same order the pinned self row renders.
    expect(rowTexts(wrapper, 'boards-score')).toEqual([
      `SS${groupThousands(2864)}`,
      `A${groupThousands(2402)}`
    ])
    expect(rowTexts(wrapper, 'boards-grade')).toEqual(['SS', 'A'])
    // raw renders as its own column, whole words like wpm.
    expect(wrapper.text()).toContain('90')
    expect(wrapper.text()).toContain('77')

    wrapper.unmount()
  })

  it('crowns rank 1 and gives the podium muted medals — everyone else, numbers', async () => {
    h.page.mockResolvedValue(
      page([
        entry({ rank: 1, userId: 'u1', runId: 'r1' }),
        entry({ rank: 2, userId: 'u2', runId: 'r2' }),
        entry({ rank: 3, userId: 'u3', runId: 'r3' }),
        entry({ rank: 4, userId: 'u4', runId: 'r4' })
      ])
    )

    const wrapper = await mountTable({ bucket: BUCKET })

    const ranks = wrapper.findAll('[data-testid="boards-rank"]')
    expect(ranks[0].find('.board__crown').exists()).toBe(true)
    expect(ranks[1].find('.board__medal').exists()).toBe(true)
    expect(ranks[2].find('.board__medal').exists()).toBe(true)
    expect(ranks[3].find('.board__crown').exists()).toBe(false)
    expect(ranks[3].find('.board__medal').exists()).toBe(false)
    // 2 and 3 keep their number beside the medal — a medal alone cannot say
    // which of the two it is.
    expect(ranks[1].text()).toContain('2')
    expect(ranks[3].text()).toContain('4')

    wrapper.unmount()
  })

  it('shows the date relative, with the exact instant one hover away', async () => {
    h.page.mockResolvedValue(page([entry()]))

    const wrapper = await mountTable({ bucket: BUCKET })

    // A 2026 timestamp against the real clock is far in the past: the column
    // shows a DATE (short, locale), not a raw ISO string, and never the time
    // alone. The exact instant lives in the tooltip on hover.
    const when = wrapper.get('[data-testid="boards-when"]')
    expect(when.text()).not.toContain('2026-07-25T')
    expect(wrapper.findComponent({ name: 'TooltipRoot' }).exists()).toBe(true)

    wrapper.unmount()
  })

  it('offers watch and race actions on the row, reaching their routes', async () => {
    h.page.mockResolvedValue(page([entry({ runId: 'run-42' })]))

    const wrapper = await mountTable({ bucket: BUCKET })
    const push = vi.spyOn(router, 'push')

    await wrapper.get('[data-testid="boards-action-watch"]').trigger('click')
    expect(push).toHaveBeenLastCalledWith({
      name: ROUTE_NAMES.REPLAY,
      params: { runId: 'run-42' },
      query: { bucket: BUCKET }
    })

    await wrapper.get('[data-testid="boards-action-race"]').trigger('click')
    expect(push).toHaveBeenLastCalledWith({
      name: ROUTE_NAMES.RACE,
      params: { runId: 'run-42' },
      query: { bucket: BUCKET }
    })

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

  it('jumps to a loaded row without touching the network', async () => {
    h.page.mockResolvedValue(page([entry({ userId: 'me', runId: 'r1' })]))

    const wrapper = await mountTable({ bucket: BUCKET, selfUserId: 'me' })

    const landed = await (
      wrapper.vm as unknown as { jumpToUser: (id: string) => Promise<boolean> }
    ).jumpToUser('me')

    expect(landed).toBe(true)
    expect(h.around).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('fetches the around=me window for an unloaded self, and renders the gap above it', async () => {
    h.page.mockResolvedValue(
      page([entry({ rank: 1, userId: 'a', runId: 'r1', displayName: 'top' })], 'CURSOR-2')
    )
    h.around.mockResolvedValue({
      bucket: BUCKET,
      entries: [
        entry({ rank: 41, userId: 'x', runId: 'r41', displayName: 'above-me' }),
        entry({ rank: 42, userId: 'me', runId: 'r42', displayName: 'myself' }),
        entry({ rank: 43, userId: 'y', runId: 'r43', displayName: 'below-me' })
      ],
      prevCursor: 'PREV-41',
      nextCursor: 'NEXT-43'
    })

    const wrapper = await mountTable({ bucket: BUCKET, selfUserId: 'me' })
    expect(rowTexts(wrapper, 'boards-player')).toEqual(['top'])

    const landed = await (
      wrapper.vm as unknown as { jumpToUser: (id: string) => Promise<boolean> }
    ).jumpToUser('me')
    await settle()

    expect(landed).toBe(true)
    expect(h.around).toHaveBeenCalledWith(BUCKET)
    // Two segments now: [1] and [41..43], with the gap's upward affordance
    // between them and the tail's downward one under the window.
    expect(rowTexts(wrapper, 'boards-rank')).toEqual(['1', '41', '42', '43'])
    expect(wrapper.find('[data-testid="boards-more-above"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="boards-more"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('reports an un-jumpable self honestly — a 204 window is not an error', async () => {
    h.page.mockResolvedValue(page([entry({ userId: 'a', runId: 'r1' })]))
    h.around.mockResolvedValue(null)

    const wrapper = await mountTable({ bucket: BUCKET, selfUserId: 'me' })

    const landed = await (
      wrapper.vm as unknown as { jumpToUser: (id: string) => Promise<boolean> }
    ).jumpToUser('me')

    expect(landed).toBe(false)
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('grows a window upward through the gap until the segments merge', async () => {
    h.page.mockResolvedValue(
      page([entry({ rank: 1, userId: 'a', runId: 'r1', displayName: 'top' })], 'CURSOR-2')
    )
    h.around.mockResolvedValue({
      bucket: BUCKET,
      entries: [entry({ rank: 3, userId: 'me', runId: 'r3', displayName: 'myself' })],
      prevCursor: 'PREV-3'
    })
    h.before.mockResolvedValue({
      bucket: BUCKET,
      entries: [entry({ rank: 2, userId: 'b', runId: 'r2', displayName: 'between' })]
      // No prevCursor: rank 2 is directly under rank 1.
    })

    const wrapper = await mountTable({ bucket: BUCKET, selfUserId: 'me' })
    await (wrapper.vm as unknown as { jumpToUser: (id: string) => Promise<boolean> }).jumpToUser(
      'me'
    )
    await settle()
    expect(rowTexts(wrapper, 'boards-rank')).toEqual(['1', '3'])

    await wrapper.get('[data-testid="boards-more-above"]').trigger('click')
    await settle()

    expect(h.before).toHaveBeenCalledWith(BUCKET, 'PREV-3')
    // 1 + 2 + 3 are contiguous now: one segment, no gap affordance left.
    expect(rowTexts(wrapper, 'boards-rank')).toEqual(['1', '2', '3'])
    expect(wrapper.find('[data-testid="boards-more-above"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('drops the accumulation when the bucket changes', async () => {
    const OTHER = 'words:25:en:seeded'
    h.page.mockImplementation((bucket: string, cursor?: string) =>
      Promise.resolve(
        bucket === BUCKET
          ? {
              bucket: BUCKET,
              entries:
                cursor === undefined
                  ? [entry({ rank: 1, userId: 'u1', displayName: 'old-board', runId: 'r1' })]
                  : [entry({ rank: 2, userId: 'u2', displayName: 'old-board-2', runId: 'r2' })],
              ...(cursor === undefined ? { nextCursor: 'CURSOR-2' } : {})
            }
          : {
              bucket: OTHER,
              entries: [entry({ rank: 1, userId: 'u9', displayName: 'new-board', runId: 'r9' })]
            }
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
