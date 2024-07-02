export enum CookieType {
  SECURITY = 'security',
  METRICS = 'metrics'
}

export interface Cookie {
  name: string
  enabled: boolean
  type: CookieType
}
