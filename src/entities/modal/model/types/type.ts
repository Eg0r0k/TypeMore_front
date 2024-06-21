type Modal = {
  isOpen: boolean
  view: any
  actions?: ModalAction[]
  isCommandLine?: boolean
}

type ModalAction = {
  label: string
  callback: (props?: any) => void
}

export type { Modal, ModalAction }
