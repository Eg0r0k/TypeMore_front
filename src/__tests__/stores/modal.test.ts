import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useModal } from '@/entities/modal/model/store'
import { DEFAULT_MODAL_STATE } from '@/entities/modal/const/defaultModal'
import { ModalHandlers } from '@/entities/modal'

describe('useModal store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default values', () => {
    const modalStore = useModal()
    expect(modalStore.isOpen).toBe(false)
    expect(modalStore.view).toBe(null)
    expect(modalStore.alignment).toBe('center')
    expect(modalStore.justify).toBe('center')
    expect(modalStore.closeOnClickOutside).toBe(true)
    expect(modalStore.handlers).toEqual({})
  })

  it('should open the modal with provided parameters', () => {
    const modalStore = useModal()
    const TestComponent = { template: '<div>Test</div>' }
    const handlers: ModalHandlers = { onClose: () => {} }
    modalStore.open(TestComponent, 'top', 'left', false, handlers)
    expect(modalStore.isOpen).toBe(true)
    expect(modalStore.view).toBe(TestComponent)
    expect(modalStore.alignment).toBe('top')
    expect(modalStore.justify).toBe('left')
    expect(modalStore.closeOnClickOutside).toBe(false)
    expect(modalStore.handlers).toStrictEqual(handlers)
  })

  it('should close the modal and reset state', () => {
    const modalStore = useModal()
    const TestComponent = { template: '<div>Test</div>' }

    modalStore.open(TestComponent)
    modalStore.close()

    expect(modalStore.isOpen).toBe(DEFAULT_MODAL_STATE.isOpen)
    expect(modalStore.view).toBe(DEFAULT_MODAL_STATE.view)
    expect(modalStore.alignment).toBe(DEFAULT_MODAL_STATE.alignment)
    expect(modalStore.justify).toBe(DEFAULT_MODAL_STATE.justify)
    expect(modalStore.closeOnClickOutside).toBe(DEFAULT_MODAL_STATE.closeOnClickOutside)
    expect(modalStore.handlers).toEqual(DEFAULT_MODAL_STATE.handlers)
  })
})
