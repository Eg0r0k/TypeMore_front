import { type Modal, ModalHandlers } from '../types/type'

export const DEFAULT_MODAL_STATE: Modal = {
  isOpen: false,
  view: null as any,
  alignment: 'center' as 'top' | 'bottom' | 'center' | 'none',
  justify: 'center' as 'left' | 'right' | 'center' | 'none',
  closeOnClickOutside: true,
  handlers: {} as ModalHandlers,
  data: null
} as const
