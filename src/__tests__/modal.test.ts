import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ModalWindow } from '@/widgets/modal'
import { useModal } from '@/entities/modal/model/store'


vi.mock('gsap', () => ({
  default: {
    set: vi.fn(),
    to: vi.fn()
  }
}))

let gsap: any

beforeAll(async () => {
  gsap = (await import('gsap')).default
})

describe('ModalWindow', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(ModalWindow, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          })
        ],
        stubs: ['Teleport']
      }
    })
  })

  it('renders correctly when isOpen is true', async () => {
    const store = useModal()
    store.isOpen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal').exists()).toBe(true)
  })

  it('does not render when isOpen is false', async () => {
    const store = useModal()
    store.isOpen = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal').exists()).toBe(false)
  })

  it('applies correct classes based on alignment and justify', async () => {
    const store = useModal()
    store.isOpen = true
    store.alignment = 'top'
    store.justify = 'left'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal').classes()).toContain('alignment-top')
    expect(wrapper.find('.modal').classes()).toContain('justify-left')
  })

  it('closes modal when clicked outside if closeOnClickOutside is true', async () => {
    const store = useModal()
    store.isOpen = true
    store.closeOnClickOutside = true
    await wrapper.vm.$nextTick()

    document.body.click()

    expect(store.close).toHaveBeenCalled()
  })
  it('does not close modal on Escape key press when closeOnClickOutside is false', async () => {
    const store = useModal()
    store.isOpen = true
    store.closeOnClickOutside = false
    await wrapper.vm.$nextTick()
    await wrapper.find('.modal').trigger('keydown.esc')
    expect(store.close).not.toHaveBeenCalled()
  })
  it('calls animation functions on transition hooks', async () => {
    const store = useModal()
    store.isOpen = true
    await wrapper.vm.$nextTick()

    const el = wrapper.find('.modal').element
    wrapper.vm.onBeforeEnter(el)
    expect(gsap.set).toHaveBeenCalledWith(el, { scale: 0.8, opacity: 0 })

    const done = vi.fn()
    wrapper.vm.onEnter(el, done)
    expect(gsap.to).toHaveBeenCalledWith(
      el,
      expect.objectContaining({
        duration: 0.35,
        scale: 1,
        opacity: 1,
        ease: 'back.out(2)',
        onComplete: done
      })
    )

    wrapper.vm.onLeave(el, done)
    expect(gsap.to).toHaveBeenCalledWith(
      el,
      expect.objectContaining({
        duration: 0.35,
        scale: 0.9,
        opacity: 0,
        ease: 'back.out(2)',
        onComplete: done
      })
    )
  })

  it('renders the correct view component', async () => {
    const store = useModal()
    const TestComponent = { template: '<div>Test Component</div>' }
    store.isOpen = true
    store.view = TestComponent
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(TestComponent).exists()).toBe(true)
  })
  it('passes the model prop to the view component', async () => {
    const store = useModal()
    const TestComponent = {
      template: '<div>{{ model.testProp }}</div>',
      props: ['model']
    }
    store.isOpen = true
    store.view = TestComponent
    await wrapper.vm.$nextTick()

    const modelProp = wrapper.findComponent(TestComponent).props('model')
    expect(modelProp).toBeDefined()
    expect(modelProp).toEqual({})
  })

  it('stops propagation of click events on the modal content', async () => {
    const store = useModal()
    const closeSpy = vi.spyOn(store, 'close')

    store.isOpen = true
    store.closeOnClickOutside = true
    store.view = { template: '<div>Test Component</div>' }
    await wrapper.vm.$nextTick()

    const modalContent = wrapper.find('.modal > *')
    await modalContent.trigger('click')

    expect(closeSpy).not.toHaveBeenCalled() 
  })
  it('stops propagation of click events on the modal content', async () => {
    const store = useModal()
    const closeSpy = vi.spyOn(store, 'close')

    store.isOpen = true
    store.closeOnClickOutside = true
    store.view = { template: '<div>Test Component</div>' }
    await wrapper.vm.$nextTick()

    const modalContent = wrapper.find('.modal > *')
    await modalContent.trigger('click')

    expect(closeSpy).not.toHaveBeenCalled() 
  })
  it('does not close modal when clicked outside if closeOnClickOutside is false', async () => {
    const store = useModal()
    store.isOpen = true
    store.closeOnClickOutside = false
    await wrapper.vm.$nextTick()


    document.body.click() 

    expect(store.close).not.toHaveBeenCalled()
  })
  it('sets correct tabindex and aria-modal attributes', async () => {
    const store = useModal()
    store.isOpen = true
    await wrapper.vm.$nextTick()

    const modalElement = wrapper.find('.modal')
    expect(modalElement.attributes('tabindex')).toBe('0')
    expect(modalElement.attributes('aria-modal')).toBe('true')
  })

  it('uses default alignment and justify values when not provided', async () => {
    const store = useModal()
    store.isOpen = true
    store.alignment = undefined
    store.justify = undefined
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.modal').classes()).toContain('alignment-center')
    expect(wrapper.find('.modal').classes()).toContain('justify-center')
  })

  it('updates classes when alignment and justify change', async () => {
    const store = useModal()
    store.isOpen = true
    store.alignment = 'top'
    store.justify = 'left'
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.modal').classes()).toContain('alignment-top')
    expect(wrapper.find('.modal').classes()).toContain('justify-left')

    store.alignment = 'bottom'
    store.justify = 'right'
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.modal').classes()).toContain('alignment-bottom')
    expect(wrapper.find('.modal').classes()).toContain('justify-right')
  })
})
