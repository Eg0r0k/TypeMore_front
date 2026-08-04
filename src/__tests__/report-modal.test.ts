/**
 * The report modal (`features/modal/report`) against the filing contract of
 * backend `docs/REPORTS.md`: reason from the SUBJECT's own vocabulary, an
 * optional comment, one "sent" confirmation, and refusal codes surfaced
 * inline. The endpoint layer is mocked at its module seam — the mutation
 * wrapper above it runs for real.
 *
 * The Select's listbox cannot be opened under happy-dom (see select.test.ts),
 * so choosing a reason drives `SelectRoot`'s model directly.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { SelectRoot } from 'reka-ui'

import { i18n } from '@app/i18n'
import { ApiError } from '@shared/api'

const fileReport = vi.fn()
vi.mock('@/shared/api/reports/endpoints', () => ({
  fileReport: (input: unknown) => fileReport(input)
}))

const toastSuccess = vi.fn()
vi.mock('@/shared/ui/sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() }
}))

import { ReportModal } from '@/features/modal/report'

const SUBJECT = { type: 'quote', id: 'b7f8c2aa-0000-4000-8000-000000000001' } as const

const mountModal = () =>
  mount(ReportModal, {
    props: { open: true, subject: SUBJECT, subjectLabel: 'Frank Herbert, Dune' },
    global: {
      plugins: [
        i18n,
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }
        ]
      ]
    },
    attachTo: document.body
  })

const pickReason = async (wrapper: ReturnType<typeof mountModal>, reason: string) => {
  wrapper.findComponent(SelectRoot).vm.$emit('update:modelValue', reason)
  await nextTick()
}

const submitButton = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="report-submit"]')!

describe('report modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('refuses to submit until a reason is chosen', async () => {
    const wrapper = mountModal()
    await nextTick()

    expect(document.querySelector('[data-testid="report-reason"]')).toBeTruthy()
    expect(submitButton().disabled).toBe(true)

    await pickReason(wrapper, 'typo')
    expect(submitButton().disabled).toBe(false)
    expect(fileReport).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('files the report with the trimmed comment, confirms and closes', async () => {
    fileReport.mockResolvedValueOnce({
      id: 'r-1',
      subject: { type: SUBJECT.type, id: SUBJECT.id },
      reason: 'typo',
      status: 'open',
      createdAt: '2026-08-04T00:00:00Z'
    })
    const wrapper = mountModal()
    await nextTick()
    await pickReason(wrapper, 'typo')

    const comment = document.querySelector<HTMLTextAreaElement>(
      'textarea[data-testid="report-comment"]'
    )!
    comment.value = '  second word is misspelled  '
    comment.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    submitButton().click()
    await flushPromises()

    expect(fileReport).toHaveBeenCalledExactlyOnceWith({
      subject: SUBJECT,
      reason: 'typo',
      comment: 'second word is misspelled'
    })
    expect(toastSuccess).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])

    wrapper.unmount()
  })

  it('omits an empty comment from the body entirely', async () => {
    fileReport.mockResolvedValueOnce({
      id: 'r-1',
      subject: { type: SUBJECT.type, id: SUBJECT.id },
      reason: 'other',
      status: 'open',
      createdAt: '2026-08-04T00:00:00Z'
    })
    const wrapper = mountModal()
    await nextTick()
    await pickReason(wrapper, 'other')

    submitButton().click()
    await flushPromises()

    expect(fileReport).toHaveBeenCalledExactlyOnceWith({ subject: SUBJECT, reason: 'other' })

    wrapper.unmount()
  })

  it('surfaces a refusal inline and stays open', async () => {
    fileReport.mockRejectedValueOnce(new ApiError({ status: 429, code: 'rate_limited' }))
    const wrapper = mountModal()
    await nextTick()
    await pickReason(wrapper, 'typo')

    submitButton().click()
    await flushPromises()

    const error = document.querySelector('[data-testid="report-error"]')
    expect(error).toBeTruthy()
    expect(error!.textContent).toContain(i18n.global.t('report.errors.tooMany'))
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toBeUndefined()

    wrapper.unmount()
  })
})
