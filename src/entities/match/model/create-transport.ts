/**
 * Default transport factory for the match session (C1 contract):
 *
 * - Production: `WsTransport` against `VITE_WS_URL`, or `/ws` at the API
 *   host's root derived from `VITE_API_URL` (or the legacy alias
 *   `VITE_API_BASE_URL`), or the page origin as a last resort.
 * - Loopback mode (dev / E2E builds AND `?mp=loopback` in the URL): a
 *   `LoopbackTransport` on a page-global `LoopbackServer`, with
 *   `window.__tmLoopback = { server, addBot }` installed so Playwright can
 *   seat scripted opponents in the current room.
 */
import {
  type MatchTransport,
  LoopbackServer,
  LoopbackTransport,
  WsTransport
} from '@shared/match-transport'

import { type LoopbackBotOptions, addLoopbackBot } from './loopback-bot'

export interface LoopbackHarness {
  readonly server: LoopbackServer
  /** Seat a scripted bot in the room the page transport is currently in. */
  addBot(options?: LoopbackBotOptions): Promise<void>
}

interface LoopbackWindow {
  __tmLoopback?: LoopbackHarness
}

/** Resolve the production realtime endpoint. Exported for testability. */
export function resolveWsUrl(): string {
  const env = import.meta.env
  if (env.VITE_WS_URL) return env.VITE_WS_URL
  const base = env.VITE_API_URL ?? env.VITE_API_BASE_URL
  if (base) {
    const url = new URL('/ws', base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  }
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
}

function loopbackRequested(): boolean {
  const env = import.meta.env
  if (!env.DEV && !env.VITE_E2E) return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mp') === 'loopback'
}

function createLoopbackTransport(): MatchTransport {
  const w = window as unknown as LoopbackWindow
  const server = w.__tmLoopback?.server ?? new LoopbackServer()
  const transport = new LoopbackTransport(server)

  // Track the page transport's room so addBot() can join "the current room".
  let roomCode: string | null = null
  transport.onEvent((event) => {
    if (event.type === 'room_state') roomCode = event.code
    else if (event.type === 'kicked') roomCode = null
  })

  w.__tmLoopback = {
    server,
    addBot: (options) => {
      if (roomCode === null)
        return Promise.reject(new Error('__tmLoopback.addBot(): the page is not in a room yet'))
      return addLoopbackBot(server, roomCode, options)
    }
  }
  return transport
}

/** The session store's default transport (DI overrides it in tests/harness). */
export function createMatchTransport(): MatchTransport {
  if (loopbackRequested()) return createLoopbackTransport()
  return new WsTransport({ url: resolveWsUrl() })
}
