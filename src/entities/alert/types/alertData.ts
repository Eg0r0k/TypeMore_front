export enum AlertType {
  Error = 'error',
  Info = 'info',
  Success = 'success',
  Warning = 'warn'
}
export interface AlertData {
  id: number
  type: AlertType
  msg: string
  title?: string
  duration?: number
  closable?: boolean
}
