/**
 * The triage inbox. One row is one SUBJECT (the server groups), and the row
 * only records decisions or links out — a ban or a withdrawal happens on the
 * surface that owns it. The API layer is the mock boundary; what was ASKED is
 * asserted alongside what rendered.
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
  detail: vi.fn(),
  resolve: vi.fn(),
  permissions: ['reports:read'] as string[]
}))

vi.mock('@shared/api', () => ({
  reportQueueQueryOptions: (type?: string) => ({
    queryKey: ['admin', 'report-queue', type ?? 'all'],
    queryFn: () => h.queue(type),
    retry: false
  }),
  subjectReportsQueryOptions: (type: string, id: string) => ({
    queryKey: ['admin', 'subject-reports', type, id],
    queryFn: () => h.detail(type, id),
    retry: false
  }),
  useResolveReportsMutation: () => ({
    isPending: ref(false),
    mutate: (input: unknown, opts?: { onError?: () => void }) => {
      h.resolve(input)?.catch?.(() => opts?.onError?.())
    }
  })
}))

vi.mock('@/entities/auth', () => ({
  useCurrentUser: () => ({ data: ref({ permissions: h.permissions }) })
}))

const { ReportQueue } = await import('@/features/admin')

const item = (overrides: Record<string, unknown> = {}) => ({
  subject: { type: 'user', id: '11111111-0000-4000-8000-000000000001' },
  openReports: 3,
  firstReported: '2026-08-01T10:00:00Z',
  lastReported: '2026-08-05T10:00:00Z',
  reasons: ['cheating'],
  snapshot: { userName: 'grief3r' },
  ...overrides
})

function mountQueue() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/u/:name', name: 'user', component: { template: '<div />' } }
    ]
  })
  return mount(ReportQueue, {
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

describe('the report inbox', () => {
  beforeEach(() => {
    h.queue.mockReset()
    h.detail.mockReset()
    h.resolve.mockReset()
    h.permissions = ['reports:read']
    h.queue.mockResolvedValue({ items: [] })
  })

  it('renders a subject group: pressure, reasons, and the profile deep-link', async () => {
    h.queue.mockResolvedValue({ items: [item()] })
    const wrapper = mountQueue()
    await flushPromises()

    const row = wrapper.get('[data-testid="admin-reports-item"]')
    expect(row.get('[data-testid="admin-reports-count"]').text()).toContain('3')
    expect(row.text()).toContain('cheating')
    expect(row.get('[data-testid="admin-reports-subject-user"]').attributes('href')).toBe(
      '/u/grief3r'
    )
  })

  it('asks the server per subject type when a filter is picked', async () => {
    const wrapper = mountQueue()
    await flushPromises()
    expect(h.queue).toHaveBeenCalledWith(undefined)

    await wrapper.get('[data-testid="admin-reports-filter-quote"]').trigger('click')
    await flushPromises()

    expect(h.queue).toHaveBeenCalledWith('quote')
  })

  it('says the queue is clear instead of rendering nothing', async () => {
    const wrapper = mountQueue()
    await flushPromises()

    expect(wrapper.find('[data-testid="admin-reports-empty"]').exists()).toBe(true)
  })

  it('surfaces a failed load with a retry, not an empty queue', async () => {
    h.queue.mockRejectedValue(new Error('boom'))
    const wrapper = mountQueue()
    await flushPromises()

    expect(wrapper.find('[data-testid="admin-reports-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-reports-empty"]').exists()).toBe(false)
  })

  it('loads the subject reports on expand, and offers no resolve form to a reader', async () => {
    h.queue.mockResolvedValue({ items: [item()] })
    h.detail.mockResolvedValue({
      subject: { type: 'user', id: '11111111-0000-4000-8000-000000000001' },
      reports: [
        {
          id: 'r1',
          reason: 'cheating',
          comment: 'wpm 400',
          status: 'open',
          createdAt: '2026-08-05T10:00:00Z',
          reporterName: 'witness'
        }
      ]
    })
    const wrapper = mountQueue()
    await flushPromises()

    await wrapper
      .get('[data-testid="admin-reports-toggle-user-11111111-0000-4000-8000-000000000001"]')
      .trigger('click')
    await flushPromises()

    expect(h.detail).toHaveBeenCalledWith('user', '11111111-0000-4000-8000-000000000001')
    const reports = wrapper.get('[data-testid="admin-subject-reports"]')
    expect(reports.text()).toContain('witness')
    expect(reports.text()).toContain('wpm 400')
    expect(wrapper.find('[data-testid="admin-resolve-form"]').exists()).toBe(false)
  })

  it('resolves with the verdict and the trimmed note when the writer asks', async () => {
    h.permissions = ['reports:read', 'reports:write']
    h.queue.mockResolvedValue({ items: [item()] })
    h.detail.mockResolvedValue({
      subject: { type: 'user', id: '11111111-0000-4000-8000-000000000001' },
      reports: []
    })
    h.resolve.mockResolvedValue({})
    const wrapper = mountQueue()
    await flushPromises()

    await wrapper
      .get('[data-testid="admin-reports-toggle-user-11111111-0000-4000-8000-000000000001"]')
      .trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="admin-resolve-note"]').setValue('  banned for a week  ')
    await wrapper.get('[data-testid="admin-resolve-actioned"]').trigger('click')

    expect(h.resolve).toHaveBeenCalledWith({
      subject: { type: 'user', id: '11111111-0000-4000-8000-000000000001' },
      verdict: 'actioned',
      note: 'banned for a week'
    })
  })
})
