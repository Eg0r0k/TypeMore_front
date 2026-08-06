/**
 * The run review queue. It lists judged runs above a suspicion floor —
 * accepted ones included, which is the point of the queue — and an override
 * goes out with a required reason, never touching `pending`.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import en from '@/app/i18n/locales/en'

const h = vi.hoisted(() => ({
  queue: vi.fn(),
  overrides: vi.fn(),
  override: vi.fn(),
  permissions: ['runs:review', 'runs:override'] as string[]
}))

vi.mock('@shared/api', () => ({
  reviewQueueQueryOptions: (floor?: number) => ({
    queryKey: ['admin', 'review', 'queue', floor ?? 'default'],
    queryFn: () => h.queue(floor),
    retry: false
  }),
  runOverridesQueryOptions: (runId: string) => ({
    queryKey: ['admin', 'review', 'overrides', runId],
    queryFn: () => h.overrides(runId),
    retry: false
  }),
  useOverrideRunMutation: () => ({
    isPending: ref(false),
    mutate: (input: unknown, opts?: { onSuccess?: (r: unknown) => void; onError?: () => void }) => {
      h.override(input)?.then?.(
        (r: unknown) => opts?.onSuccess?.(r),
        () => opts?.onError?.()
      )
    }
  })
}))

vi.mock('@/entities/auth', () => ({
  usePermissions: () => ({
    permissions: ref(h.permissions),
    isModerator: ref(true),
    can: (permission: string) => h.permissions.includes(permission)
  })
}))

const { RunReview } = await import('@/features/admin')

const RUN_ID = '44444444-0000-4000-8000-000000000004'

const row = (overrides: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  userId: 'u1',
  displayName: 'speedster',
  status: 'accepted',
  mode: 'time',
  lang: 'english',
  suspicion: 0.42,
  overridden: false,
  metrics: { wpm: 212.4, raw: 220, acc: 0.988 },
  createdAt: '2026-08-05T10:00:00Z',
  ...overrides
})

function mountReview() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/u/:name', name: 'user', component: { template: '<div />' } },
      { path: '/replay/:runId', name: 'replay', component: { template: '<div />' } }
    ]
  })
  return mount(RunReview, {
    global: {
      plugins: [
        router,
        i18n,
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
        ]
      ]
    }
  })
}

describe('the run review queue', () => {
  beforeEach(() => {
    h.queue.mockReset()
    h.overrides.mockReset()
    h.override.mockReset()
    h.permissions = ['runs:review', 'runs:override']
    h.queue.mockResolvedValue({ runs: [], minSuspicion: 0.1 })
    h.overrides.mockResolvedValue({ overrides: [] })
  })

  it('renders a row: player link, status, suspicion, and the server metrics', async () => {
    h.queue.mockResolvedValue({ runs: [row()], minSuspicion: 0.1 })
    const wrapper = mountReview()
    await flushPromises()

    expect(h.queue).toHaveBeenCalledWith(0.1)
    const item = wrapper.get('[data-testid="admin-runs-item"]')
    expect(item.get('[data-testid="admin-run-player"]').attributes('href')).toBe('/u/speedster')
    expect(item.find('[data-testid="admin-run-status-accepted"]').exists()).toBe(true)
    expect(item.get('[data-testid="admin-run-suspicion"]').text()).toBe('0.42')
    expect(item.text()).toContain('212 wpm')
    expect(item.text()).toContain('99%')
    expect(item.get('[data-testid="admin-run-replay"]').attributes('href')).toBe(
      `/replay/${RUN_ID}`
    )
  })

  it('marks a hand-decided run, because "already handled" is what a reviewer needs first', async () => {
    h.queue.mockResolvedValue({ runs: [row({ overridden: true })], minSuspicion: 0.1 })
    const wrapper = mountReview()
    await flushPromises()

    expect(wrapper.find('[data-testid="admin-run-overridden"]').exists()).toBe(true)
  })

  it('re-asks the server when the floor changes', async () => {
    const wrapper = mountReview()
    await flushPromises()

    await wrapper.get('[data-testid="admin-runs-floor-0"]').trigger('click')
    await flushPromises()

    expect(h.queue).toHaveBeenLastCalledWith(0)
  })

  it('expands into the decision history, with no form for a reader', async () => {
    h.permissions = ['runs:review']
    h.queue.mockResolvedValue({ runs: [row()], minSuspicion: 0.1 })
    h.overrides.mockResolvedValue({
      overrides: [
        {
          id: 'o1',
          runId: RUN_ID,
          fromStatus: 'flagged',
          toStatus: 'accepted',
          reason: 'human at the top of the continuum',
          decidedByName: 'egor',
          decidedAt: '2026-08-05T12:00:00Z'
        }
      ]
    })
    const wrapper = mountReview()
    await flushPromises()

    await wrapper.get(`[data-testid="admin-runs-toggle-${RUN_ID}"]`).trigger('click')
    await flushPromises()

    expect(h.overrides).toHaveBeenCalledWith(RUN_ID)
    const history = wrapper.get('[data-testid="admin-run-overrides"]')
    expect(history.text()).toContain('flagged → accepted')
    expect(history.text()).toContain('human at the top of the continuum')
    expect(wrapper.find('[data-testid="admin-run-override-form"]').exists()).toBe(false)
  })

  it('overrides with the picked status and the trimmed reason', async () => {
    h.queue.mockResolvedValue({ runs: [row({ status: 'flagged' })], minSuspicion: 0.1 })
    h.override.mockResolvedValue({})
    const wrapper = mountReview()
    await flushPromises()

    await wrapper.get(`[data-testid="admin-runs-toggle-${RUN_ID}"]`).trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="admin-run-target-accepted"]').trigger('click')
    await wrapper.get('[data-testid="admin-run-reason"]').setValue('  false positive  ')
    await wrapper.get('[data-testid="admin-run-override-form"]').trigger('submit')
    await flushPromises()

    expect(h.override).toHaveBeenCalledWith({
      runId: RUN_ID,
      status: 'accepted',
      reason: 'false positive'
    })
  })

  it('says the queue is clear instead of rendering nothing', async () => {
    const wrapper = mountReview()
    await flushPromises()

    expect(wrapper.find('[data-testid="admin-runs-empty"]').exists()).toBe(true)
  })
})
