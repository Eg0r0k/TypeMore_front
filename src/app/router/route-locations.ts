import type { RouteLocationRaw } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/route-names'

// Typed, name-based navigation targets — call sites navigate by name, never by
// hand-written path strings.
export const routeLocation = {
  home: (): RouteLocationRaw => ({ name: ROUTE_NAMES.HOME }),
  login: (): RouteLocationRaw => ({ name: ROUTE_NAMES.LOGIN }),
  register: (): RouteLocationRaw => ({ name: ROUTE_NAMES.REGISTER }),
  verify: (): RouteLocationRaw => ({ name: ROUTE_NAMES.VERIFY }),
  reset: (): RouteLocationRaw => ({ name: ROUTE_NAMES.RESET }),
  resetConfirm: (): RouteLocationRaw => ({ name: ROUTE_NAMES.RESET_CONFIRM }),
  servers: (): RouteLocationRaw => ({ name: ROUTE_NAMES.SERVERS }),
  /** `bucket` selects one board; omitted, the page picks the busiest language one. */
  boards: (bucket?: string): RouteLocationRaw => ({
    name: ROUTE_NAMES.BOARDS,
    ...(bucket === undefined ? {} : { query: { bucket } })
  }),
  room: (): RouteLocationRaw => ({ name: ROUTE_NAMES.ROOM }),
  profile: (): RouteLocationRaw => ({ name: ROUTE_NAMES.PROFILE })
} as const
