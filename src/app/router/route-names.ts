export const ROUTE_NAMES = {
  HOME: 'home',
  LOGIN: 'login',
  REGISTER: 'register',
  VERIFY: 'verify',
  RESET: 'reset',
  RESET_CONFIRM: 'reset-confirm',
  CALLBACK: 'auth-callback',
  SERVERS: 'servers',
  ROOM: 'room',
  PROFILE: 'profile',
  ERROR: 'error',
  MATCH: 'match',
  BOARDS: 'boards',
  REPLAY: 'replay'
} as const

export type AppRouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]
