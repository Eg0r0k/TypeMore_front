/**
 * ConsoleModal is the shared searchable picker (themes, test language). It owns
 * its dialog, so everything it renders lives in the portal — the assertions read
 * `document`, not the wrapper.
 */
import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@app/i18n'
import { ConsoleModal } from '@/features/modal/console'
import { stubElementSize } from './helpers/element-size'

// The option list is virtualized: without a viewport height the virtualizer
// renders no rows at all in happy-dom.
let restoreSizes: () => void
beforeAll(() => (restoreSizes = stubElementSize()))
afterAll(() => restoreSizes())

const global = { plugins: [i18n] }

const options = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))

const optionByText = (text: string): HTMLElement => {
  const found = options().find((option) => option.textContent?.trim() === text)
  if (!found) throw new Error(`no option "${text}" in [${options().map((o) => o.textContent)}]`)
  return found
}

const search = async (query: string): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('.search-bar__input')!
  input.value = query
  input.dispatchEvent(new Event('input'))
  await nextTick()
}

const mounted: { unmount: () => void }[] = []

const mountModal = (props: Record<string, unknown>) => {
  const wrapper = mount(ConsoleModal, {
    props: { open: true, title: 'Picker', items: ['alpha', 'beta', 'gamma'], ...props },
    global,
    attachTo: document.body
  })
  mounted.push(wrapper)
  return wrapper
}

// The dialog is portalled into <body>: without an explicit unmount the previous
// test's list is still there and every `document` query sees two modals.
afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

describe('ConsoleModal', () => {
  it('picks a single value and closes itself', async () => {
    const wrapper = mountModal({ modelValue: 'alpha' })
    await nextTick()

    expect(optionByText('alpha').getAttribute('aria-selected')).toBe('true')

    optionByText('beta').click()
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['beta'])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('stays open and toggles membership when multiple', async () => {
    const wrapper = mountModal({ multiple: true, modelValue: ['alpha'] })
    await nextTick()

    optionByText('beta').click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['alpha', 'beta']])

    await wrapper.setProps({ modelValue: ['alpha', 'beta'] })
    optionByText('alpha').click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['beta']])
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('filters by the search key and keeps object items selectable', async () => {
    const wrapper = mountModal({
      items: [
        { name: 'dark', id: 'a' },
        { name: 'light', id: 'b' }
      ],
      searchKey: 'name',
      valueKey: 'id',
      modelValue: 'a'
    })
    await nextTick()

    expect(optionByText('dark').getAttribute('aria-selected')).toBe('true')

    await search('lig')
    expect(options()).toHaveLength(1)

    optionByText('light').click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b'])
  })

  it('renders nothing while closed', async () => {
    mountModal({ open: false, modelValue: 'alpha' })
    await nextTick()

    expect(document.querySelector('[role="listbox"]')).toBeNull()
  })
})
