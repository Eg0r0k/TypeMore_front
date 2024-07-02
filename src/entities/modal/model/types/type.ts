type Modal = {
  isOpen: boolean
  view: any
  actions?: ModalAction[]
  alignment?: 'top' | 'bottom' | 'center' | 'none'
  justify?: 'left' | 'right' | 'center' | 'none'
  closeOnClickOutside: boolean
}

interface ModalHandlers {
  onVerified?: (token: string) => void
  onError?: () => void
  onExpired?: () => void
}

type ModalAction = {
  label: string
  callback: (props?: any) => void
}

export type { Modal, ModalAction, ModalHandlers }
