/**
 * The results input-history block: words as typed, hover burst tooltip, the
 * quantile heatmap, and the two copy actions with their `.txt` fallback. The
 * component is a pure view over `WordHistoryEntry[]`, so a hand-built history
 * drives every case.
 */
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@/shared/ui/sonner', () => ({
  toast: { success: toastSuccess, error: toastError }
}))

import InputHistory from '@/features/test/results/input-history.vue'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { i18n } from '@app/i18n'
import type { WordHistoryEntry } from '@shared/core'

const HISTORY: readonly WordHistoryEntry[] = [
  { target: 'ab', typed: 'ab', committed: true, burst: 80 },
  { target: 'cd', typed: 'cx', committed: true, burst: 40 },
  { target: 'ef', typed: 'e', committed: false, burst: Infinity }
]

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  })
})

const mountHistory = (history: readonly WordHistoryEntry[] = HISTORY) =>
  mount(TooltipProvider, {
    global: { plugins: [i18n] },
    slots: { default: () => h(InputHistory, { history }) }
  })

describe('input history — words', () => {
  it('renders one word per entry, letters coloured by correctness', () => {
    const wrapper = mountHistory()
    const words = wrapper.findAll('.input-history__word')
    expect(words).toHaveLength(3)
    // 'cx' against 'cd': first letter correct, second incorrect.
    const letters = words[1].findAll('.letter')
    expect(letters[0].classes()).toContain('correct')
    expect(letters[1].classes()).toContain('incorrect')
  })

  it('shows the typed text and burst speed on hover, and hides it on leave', async () => {
    const wrapper = mountHistory()
    const word = wrapper.findAll('.input-history__word')[0]

    await word.trigger('mouseover')
    const tooltip = wrapper.find('[data-testid="history-tooltip"]')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('ab')
    expect(tooltip.text()).toContain('80 wpm')

    await word.trigger('mouseout')
    expect(wrapper.find('[data-testid="history-tooltip"]').exists()).toBe(false)
  })

  it('labels a zero-window burst as ∞', async () => {
    const wrapper = mountHistory()
    await wrapper.findAll('.input-history__word')[2].trigger('mouseover')
    expect(wrapper.find('[data-testid="history-tooltip"]').text()).toContain('∞')
  })
})

describe('input history — burst heatmap', () => {
  it('toggles the legend and paints words with their bucket class', async () => {
    const wrapper = mountHistory()
    expect(wrapper.find('[data-testid="history-legend"]').exists()).toBe(false)

    await wrapper.find('[data-testid="history-heatmap"]').trigger('click')
    expect(wrapper.find('[data-testid="history-legend"]').exists()).toBe(true)

    const words = wrapper.findAll('.input-history__word')
    // Thresholds over [40, 80, ∞] land at [0, 40, 80, 80, ∞]: the slowest word
    // clears the ≥40 step (h1), the 80wpm word the two ≥80 steps (h3), and the
    // ∞ word tops out (h4). Nothing sits below the 15th percentile, so h0 stays
    // empty — the same shape monkeytype's quantile scale produces.
    expect(words[1].classes()).toContain('input-history__word--h1')
    expect(words[0].classes()).toContain('input-history__word--h3')
    expect(words[2].classes()).toContain('input-history__word--h4')

    await wrapper.find('[data-testid="history-heatmap"]').trigger('click')
    expect(wrapper.find('[data-testid="history-legend"]').exists()).toBe(false)
    expect(words[2].classes()).not.toContain('input-history__word--h4')
  })
})

describe('input history — copy actions', () => {
  it('copies the full word list to the clipboard', async () => {
    writeText.mockResolvedValue(undefined)
    const wrapper = mountHistory()

    await wrapper.find('[data-testid="history-copy-words"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('ab cd ef')
  })

  it('copies only the committed-and-missed words', async () => {
    writeText.mockResolvedValue(undefined)
    const wrapper = mountHistory()

    await wrapper.find('[data-testid="history-copy-missed"]').trigger('click')
    // 'ef' differs from its typed text too, but it was never committed.
    expect(writeText).toHaveBeenCalledWith('cd')
  })

  it('disables the missed-words action when every committed word matched', () => {
    const clean = HISTORY.map((entry) => ({ ...entry, typed: entry.target }))
    const wrapper = mountHistory(clean)
    expect(wrapper.find('[data-testid="history-copy-missed"]').attributes('disabled')).toBeDefined()
  })

  it('falls back to a .txt download when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const createObjectURL = vi.fn(() => 'blob:words')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = mountHistory()
    await wrapper.find('[data-testid="history-copy-words"]').trigger('click')
    // Two microtask hops: the rejected clipboard promise, then the fallback.
    await Promise.resolve()
    await Promise.resolve()

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(toastError).not.toHaveBeenCalled()

    click.mockRestore()
    vi.unstubAllGlobals()
  })
})
