import { defineStore } from 'pinia'
import { markRaw, reactive, toRefs } from 'vue'
import { Modal, ModalAction } from './types/type'

export const useModal = defineStore('modal', () => {
  const modal = reactive<Modal>({
    isOpen: false,
    view: null,
    actions: [],
    isCommandLine: false
  })

  const open = (view: any, actions?: ModalAction[], isCommandLine = false) => {
    modal.isOpen = true
    modal.view = markRaw(view)
    modal.actions = actions || []
    modal.isCommandLine = isCommandLine
  }

  const close = () => {
    modal.isOpen = false
    modal.view = null
    modal.actions = []
    modal.isCommandLine = false
  }

  return { ...toRefs(modal), open, close }
})
