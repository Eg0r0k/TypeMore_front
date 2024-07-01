import { defineStore } from 'pinia'
import { markRaw, reactive, toRefs } from 'vue'
import { Modal, ModalAction } from './types/type'

export const useModal = defineStore('modal', () => {
  const modal = reactive<Modal>({
    isOpen: false,
    view: null,
    actions: [],
    alignment: 'center',
    justify: 'center'
  })

  const open = (
    view: any,
    actions?: ModalAction[],
    alignment: 'top' | 'bottom' | 'center' | 'none' = 'center',
    justify: 'left' | 'right' | 'center' | 'none' = 'center'
  ) => {
    modal.isOpen = true
    modal.view = markRaw(view)
    modal.actions = actions || []
    modal.alignment = alignment
    modal.justify = justify
  }

  const close = () => {
    modal.isOpen = false
    modal.view = null
    modal.actions = []
    modal.alignment = 'none'
  }

  return { ...toRefs(modal), open, close }
})
