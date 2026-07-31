import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Scrollable } from '@/shared/ui/scrollable'
import { VirtualScrollable } from '@/shared/ui/virtualScrollable'
import { expect, it, describe, vi } from 'vitest'

describe('Scrollable', () => {
  it('Renders slot content inside scroll container', () => {
    const wrapper = mount(Scrollable, {
      slots: { default: '<p>Content</p>' }
    })
    expect(wrapper.classes()).toContain('scrollable-wrapper')
    expect(wrapper.get('.scrollable').text()).toContain('Content')
  })

  it('Applies direction classes', () => {
    const wrapper = mount(Scrollable, {
      props: { direction: 'horizontal' },
      slots: { default: '<p>Content</p>' }
    })
    expect(wrapper.classes()).toContain('scrollable-direction-x')
    expect(wrapper.get('.scrollable').classes()).toContain('scrollable-x')
  })

  it('Emits scroll event from container', async () => {
    const wrapper = mount(Scrollable, {
      slots: { default: '<p>Content</p>' }
    })
    await wrapper.get('.scrollable').trigger('scroll')
    expect(wrapper.emitted('scroll')).toHaveLength(1)
  })

  it('scrollToEnd targets the LIVE content size, not a cached measurement', () => {
    // The internal `scrollSize` computed has no reactive dependency on the DOM,
    // so it caches its first read forever. scrollToEnd built its target from
    // that cache: once the content grew, "scroll to end" scrolled to where the
    // end USED to be — visibly upward in a chat that had filled up.
    const wrapper = mount(Scrollable, {
      slots: { default: '<p>Content</p>' }
    })
    const container = wrapper.get('.scrollable').element as HTMLElement
    let height = 100
    Object.defineProperty(container, 'scrollHeight', { configurable: true, get: () => height })
    const scrollTo = vi.fn()
    container.scrollTo = scrollTo

    const vm = wrapper.vm as unknown as { scrollToEnd: (behavior?: ScrollBehavior) => void }
    vm.scrollToEnd('auto') // primes any internal cache at the small size
    height = 1000
    vm.scrollToEnd('auto')

    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 1000 }))
  })
})

describe('VirtualScrollable', () => {
  it('Renders empty slot when no items', () => {
    const wrapper = mount(VirtualScrollable, {
      props: { items: [] },
      slots: { empty: '<p>Empty</p>' }
    })
    expect(wrapper.text()).toContain('Empty')
  })

  it('Renders loader slot when loading', () => {
    const wrapper = mount(VirtualScrollable, {
      props: { items: [], loading: true },
      slots: { loader: '<p>Loading</p>' }
    })
    expect(wrapper.text()).toContain('Loading')
    expect(wrapper.text()).not.toContain('Empty')
  })

  it('Renders virtualized items with fixed item height', async () => {
    // Virtualizer reads offsetWidth/offsetHeight; happy-dom reports 0 for both
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 300
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 400
    })

    try {
      const items = Array.from({ length: 100 }, (_, i) => `item-${i}`)
      const wrapper = mount(VirtualScrollable, {
        props: { items, itemHeight: 20 },
        slots: {
          default: `<template #default="{ item }"><span class="row">{{ item }}</span></template>`
        }
      })
      await nextTick()
      const rows = wrapper.findAll('.row')
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.length).toBeLessThan(items.length)
      expect(rows[0].text()).toBe('item-0')
    } finally {
      if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalWidth)
      else Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth')
      if (originalHeight)
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalHeight)
      else Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
    }
  })
})
