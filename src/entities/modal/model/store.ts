import { defineStore } from 'pinia'
import { markRaw, reactive, toRefs } from 'vue'
import { Modal, ModalHandlers } from '../types/type'
import { DEFAULT_MODAL_STATE } from '../const/defaultModal'
/**
 * Store for controlling the modal state.
 * This store provides methods for opening and closing modals and allows configuring
 * the modal's alignment, justification, and behavior when clicking outside.
 */
export const useModal = defineStore('modal', () => {
  const modal = reactive<Modal & { handlers: ModalHandlers }>({
    isOpen: false,
    view: null,
    alignment: 'center',
    justify: 'center',
    closeOnClickOutside: true,
    handlers: {}
  })
  /**
   * Opens the modal with the specified configuration.
   * @param  view - The component to render inside the modal.
   */
  const open = (
    view: any,
    alignment: 'top' | 'bottom' | 'center' | 'none' = 'center',
    justify: 'left' | 'right' | 'center' | 'none' = 'center',
    closeOnClickOutside: boolean = true,
    handlers: ModalHandlers = {}
  ) => {
    modal.isOpen = true
    modal.view = markRaw(view)

    modal.alignment = alignment
    modal.justify = justify
    modal.closeOnClickOutside = closeOnClickOutside
    modal.handlers = handlers
  }
  /**
   * Closes the modal and resets its configuration.
   */
  const close = () => {
    Object.assign(modal, DEFAULT_MODAL_STATE)
  }

  return { ...toRefs(modal), open, close }
})
