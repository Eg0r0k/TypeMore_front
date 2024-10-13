import { defineStore } from 'pinia'
import { markRaw, reactive, toRefs } from 'vue'
import { Modal, ModalHandlers } from './types/type'

export const useModal = defineStore('modal', () => {
  const modal = reactive<Modal & { handlers: ModalHandlers }>({
    isOpen: false,
    view: null,
    alignment: 'center',
    justify: 'center',
    closeOnClickOutside: true,
    handlers: {}
  })

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

  const close = () => {
    modal.isOpen = false
    modal.view = null

    modal.alignment = 'none'
    modal.handlers = {}
  }

  return { ...toRefs(modal), open, close }
})
