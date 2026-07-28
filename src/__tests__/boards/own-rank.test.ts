/**
 * The pinned self row, whose whole job is telling three answers apart:
 *
 *   `204` (`null`)  — asked, you hold no visible slot here. A SUCCESS: the
 *                     quiet "play this mode" invitation.
 *   `401`           — nobody is signed in. Expected on a public board: the
 *                     sign-in hint, never a red box.
 *   an entry        — your rank writ large, your percentile, your metrics in
 *                     the table's own columns, and your row marked below.
 *
 * None of them is the error state, and a signed-out visitor must never see an
 * error on a page that needs no account.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { BoardEntry, BoardMe, BoardMods } from '@shared/api'
import { i18n } from '@app/i18n'
import { ROUTE_NAMES } from '@/app/router/route-names'

const h = vi.hoisted(() => ({ page: vi.fn(), me: vi.fn() }))

vi.mock('@shared/api', () => {
  // Mirrors the transport's real error shape so the 401 predicate is exercised
  // rather than stubbed.
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
import { BoardView } from '@/features/leaderboards'

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
  wpm: 83.2,
  raw: 83.2,
  acc: 1,
  grade: 'SS',
  mods: PLAIN,
  runId: 'run-1',
  achievedAt: '2026-07-25T13:43:14.772724Z',
  ...over
})

let router: Router
let queryClient: QueryClient

const settle = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const mountView = async (entriesTotal?: number) => {
  const wrapper = mount(BoardView, {
    props: { bucket: BUCKET, entriesTotal },
    global: { plugins: [i18n, router, [VueQueryPlugin, { queryClient }]] }
  })
  await settle()
  return wrapper
}

beforeEach(async () => {
  h.page.mockReset()
  h.me.mockReset()
  h.page.mockResolvedValue({ bucket: BUCKET, entries: [entry()] })
  i18n.global.locale.value = 'en'
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
  })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: ROUTE_NAMES.HOME, component: { template: '<div />' } },
      { path: '/login', name: ROUTE_NAMES.LOGIN, component: { template: '<div />' } },
      { path: '/boards', name: ROUTE_NAMES.BOARDS, component: { template: '<div />' } },
      { path: '/replay/:runId', name: ROUTE_NAMES.REPLAY, component: { template: '<div />' } }
    ]
  })
  await router.push('/boards')
  await router.isReady()
})

describe('the pinned self row', () => {
  it('reads a 204 as an invitation to play, never as a failure', async () => {
    h.me.mockResolvedValue(null)

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="boards-self-play"]').text()).toBe(
      i18n.global.t('boards.self.play')
    )
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="boards-self-rank"]').exists()).toBe(false)
    // The board underneath is untouched by the caller having no slot on it.
    expect(wrapper.findAll('[data-testid="boards-row"]')).toHaveLength(1)

    wrapper.unmount()
  })

  it('hints sign-in for a signed-out visitor — no rank, no error', async () => {
    h.me.mockRejectedValue(new ApiError({ status: 401, code: 'unauthorized' }))

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="boards-self-sign-in"]').text()).toBe(
      i18n.global.t('boards.self.signIn')
    )
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    // A public board still renders in full without a session, and there is no
    // row to jump to, so the person control is gone too.
    expect(wrapper.findAll('[data-testid="boards-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="boards-to-me"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('pins the rank, the percentile and the table’s own columns when ranked', async () => {
    const mine: BoardMe = {
      bucket: BUCKET,
      entry: entry({ rank: 7, userId: 'me', displayName: 'myself', score: 1234, wpm: 96.6 })
    }
    h.me.mockResolvedValue(mine)
    h.page.mockResolvedValue({
      bucket: BUCKET,
      entries: [
        entry({ rank: 1, userId: 'them', displayName: 'someone', runId: 'r1' }),
        entry({ rank: 7, userId: 'me', displayName: 'myself', runId: 'r7' })
      ]
    })

    const wrapper = await mountView(50)

    expect(wrapper.get('[data-testid="boards-self-rank"]').text()).toBe('#7')
    // 7 of 50 → 14%.
    expect(wrapper.get('[data-testid="boards-self-top"]').text()).toBe(
      i18n.global.t('boards.self.top', { percent: 14 })
    )
    // The metrics are the table's columns: score formatted the same way.
    expect(wrapper.get('[data-testid="boards-self-score"]').text()).toBe('1234')
    // And the caller's row below is marked as theirs.
    const players = wrapper.findAll('[data-testid="boards-player"]').map((node) => node.text())
    expect(players[0]).not.toContain(i18n.global.t('boards.you'))
    expect(players[1]).toContain(i18n.global.t('boards.you'))
    // The person control exists exactly because there is a row to jump to.
    expect(wrapper.find('[data-testid="boards-to-me"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('shows the rank alone when the catalogue cannot supply a denominator', async () => {
    h.me.mockResolvedValue({ bucket: BUCKET, entry: entry({ rank: 7, userId: 'me' }) })

    const wrapper = await mountView(undefined)

    expect(wrapper.get('[data-testid="boards-self-rank"]').text()).toBe('#7')
    expect(wrapper.find('[data-testid="boards-self-top"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps a broken /me out of the board’s error state', async () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {})
    h.me.mockRejectedValue(new ApiError({ status: 500, code: 'internal' }))

    const wrapper = await mountView()

    // Secondary read: it is logged, not rendered, and it does not make the
    // board itself look broken.
    expect(wrapper.find('[data-testid="boards-self"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="boards-self-play"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="boards-error"]').exists()).toBe(false)
    expect(logged).toHaveBeenCalled()

    logged.mockRestore()
    wrapper.unmount()
  })
})
