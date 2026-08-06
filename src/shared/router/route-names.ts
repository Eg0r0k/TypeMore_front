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
  USER: 'user',
  ERROR: 'error',
  MATCH: 'match',
  BOARDS: 'boards',
  FRIENDS: 'friends',
  REPLAY: 'replay',
  RACE: 'race',
  ADMIN: 'admin',
  ADMIN_REPORTS: 'admin-reports',
  ADMIN_PLAYERS: 'admin-players'
} as const

export type AppRouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]
