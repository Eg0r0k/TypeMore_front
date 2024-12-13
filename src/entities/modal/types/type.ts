type Modal = {
  isOpen: boolean
  view: any
  alignment?: 'top' | 'bottom' | 'center' | 'none'
  justify?: 'left' | 'right' | 'center' | 'none'
  closeOnClickOutside: boolean
  handlers: ModalHandlers
  data: any
}

interface ModalHandlers {
  onVerified?: (token: string) => void
  onError?: () => void
  onExpired?: () => void
  onClose?: () => void
}

export type { Modal, ModalHandlers }
