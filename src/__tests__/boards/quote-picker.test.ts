/**
 * The quote picker: metadata pages accumulated across the keyset walk, the
 * corpus rewrite, and the states a paged list owes its user.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({ page: vi.fn() }))

vi.mock('@shared/api', () => ({
  quotePageQueryOptions: (params: Record<string, unknown> = {}) => ({
    queryKey: ['quotes', params.lang ?? null, params.group ?? null, params.cursor ?? null],
    queryFn: () => h.page(params)
  }),
  // The real rewrite, verbatim: the picker asking `russian` for `russian_50k`
  // is part of what is under test.
  quoteCorpusLang: (language: string) => /^(.+)_\d+k$/.exec(language)?.[1] ?? language
}))

import { QuotePicker } from '@/features/leaderboards'

const meta = (id: string, source: string, lenGroup = 'medium', length = 60) => ({
  id,
  lang: 'russian',
  upstreamId: 1,
  source,
  length,
  lenGroup,
  textHash: 'deadbeef'
})

let queryClient: QueryClient

const settle = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const mountPicker = async (props: { lang?: string; group?: string } = {}) => {
  const wrapper = mount(QuotePicker, {
    props: { lang: props.lang ?? 'russian', group: (props.group ?? 'all') as never },
    global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] }
  })
  await settle()
  return wrapper
}

const rowTexts = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('[data-testid="quote-picker-row"]').map((node) => node.text())

beforeEach(() => {
  h.page.mockReset()
  i18n.global.locale.value = 'en'
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
  })
})

describe('quote picker', () => {
  it('renders attribution, band and length — metadata only, never a text', async () => {
    h.page.mockResolvedValue({
      quotes: [meta('q1', 'Franz Kafka', 'short', 42), meta('q2', 'Goethe', 'thicc', 300)]
    })

    const wrapper = await mountPicker()

    expect(rowTexts(wrapper)).toEqual(['Franz Kafkashort42 chars', 'Goethethicc300 chars'])

    wrapper.unmount()
  })

  it('asks the CORPUS for a size-variant language', async () => {
    h.page.mockResolvedValue({ quotes: [] })

    const wrapper = await mountPicker({ lang: 'russian_50k' })

    // russian_50k is Russian with a bigger word list; upstream publishes its
    // quotes once, under `russian`.
    expect(h.page).toHaveBeenCalledWith(expect.objectContaining({ lang: 'russian' }))
    expect(wrapper.find('[data-testid="quote-picker-empty"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('accumulates keyset pages under load more, and stops at the last one', async () => {
    h.page.mockImplementation((params: { cursor?: string }) =>
      params.cursor === undefined
        ? Promise.resolve({ quotes: [meta('q1', 'One')], nextCursor: 'c1' })
        : Promise.resolve({ quotes: [meta('q2', 'Two')] })
    )

    const wrapper = await mountPicker()
    expect(rowTexts(wrapper)).toHaveLength(1)

    await wrapper.get('[data-testid="quote-picker-more"]').trigger('click')
    await settle()

    expect(rowTexts(wrapper)).toEqual(['Onemedium60 chars', 'Twomedium60 chars'])
    expect(wrapper.find('[data-testid="quote-picker-more"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('resets the walk when the filter changes — two filters are two walks', async () => {
    h.page.mockImplementation((params: { group?: string }) =>
      Promise.resolve({
        quotes: params.group === 'short' ? [meta('q1', 'Short one', 'short')] : [meta('q2', 'Any')]
      })
    )

    const wrapper = await mountPicker()
    expect(rowTexts(wrapper)).toEqual(['Anymedium60 chars'])

    await wrapper.setProps({ group: 'short' as never })
    await settle()

    // Replaced, not appended: the short walk starts from its own first page.
    expect(rowTexts(wrapper)).toEqual(['Short oneshort60 chars'])

    wrapper.unmount()
  })

  it('emits the picked id', async () => {
    h.page.mockResolvedValue({ quotes: [meta('q1', 'Franz Kafka')] })

    const wrapper = await mountPicker()
    await wrapper.get('[data-testid="quote-picker-row"]').trigger('click')

    expect(wrapper.emitted('pick')).toEqual([['q1']])

    wrapper.unmount()
  })

  it('offers a retry when the index fails, and recovers on it', async () => {
    h.page.mockRejectedValueOnce(new Error('offline'))

    const wrapper = await mountPicker()

    expect(wrapper.find('[data-testid="quote-picker-error"]').exists()).toBe(true)

    h.page.mockResolvedValue({ quotes: [meta('q1', 'Franz Kafka')] })
    await wrapper.get('[data-testid="quote-picker-retry"]').trigger('click')
    await settle()

    expect(rowTexts(wrapper)).toHaveLength(1)
    expect(wrapper.find('[data-testid="quote-picker-error"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
