/**
 * Lobby controls against the match-session contract (§3 `start_match` gating):
 * the start button is host-only and enabled only with ≥2 seats and every
 * non-host seat ready; non-hosts get a ready/un-ready toggle (Δ1).
 * The session store is a hand-built reactive stub — no Pinia, no transport.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { reactive } from 'vue'

import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({ store: {} as unknown }))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.store
}))

vi.mock('~icons/tabler/check', () => ({
  default: { name: 'IconCheck', template: '<svg data-icon="check" />' }
}))
vi.mock('~icons/tabler/logout', () => ({
  default: { name: 'IconLogout', template: '<svg data-icon="logout" />' }
}))
vi.mock('~icons/tabler/player-play', () => ({
  default: { name: 'IconPlayerPlay', template: '<svg data-icon="player-play" />' }
}))

import { RoomControls } from '@/features/room/controls'

interface SeatSpec {
  playerId: string
  ready?: boolean
}

interface StubSeat {
  playerId: string
  nick: string
  isGuest: boolean
  ready: boolean
  freemods: { difficulty: string; minWpm: number; nospace: boolean }
}

interface ControlsStub {
  room: {
    code: string
    name: string
    visibility: string
    hostPlayerId: string
    settings: Record<string, unknown>
    players: StubSeat[]
  }
  selfId: string
  isHost: boolean
  lastError: { code: string; message: string } | null
  startMatch: Mock
  setReady: Mock
  leaveRoom: Mock
}

function makeStore(opts: { selfId: string; hostId: string; seats: SeatSpec[] }): ControlsStub {
  const store: ControlsStub = reactive({
    room: {
      code: 'K7GQ2M',
      name: 'room',
      visibility: 'private',
      hostPlayerId: opts.hostId,
      settings: {},
      players: opts.seats.map((seat) => ({
        playerId: seat.playerId,
        nick: seat.playerId,
        isGuest: false,
        ready: seat.ready ?? false,
        freemods: { difficulty: 'normal', minWpm: 0, nospace: false }
      }))
    },
    selfId: opts.selfId,
    isHost: opts.selfId === opts.hostId,
    lastError: null,
    startMatch: vi.fn(),
    setReady: vi.fn(),
    leaveRoom: vi.fn()
  })
  h.store = store
  return store
}

const mountControls = () => mount(RoomControls, { global: { plugins: [i18n] } })

describe('RoomControls — start gating (host)', () => {
  it('disables start with a single seat and hints for more players', () => {
    makeStore({ selfId: 'p1', hostId: 'p1', seats: [{ playerId: 'p1' }] })
    const wrapper = mountControls()

    const start = wrapper.find('[data-testid="start-button"]')
    expect(start.exists()).toBe(true)
    expect(start.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="start-hint"]').text()).toBe(
      'waiting for at least one more player'
    )
  })

  it('disables start while any non-host seat is unready', () => {
    makeStore({
      selfId: 'p1',
      hostId: 'p1',
      seats: [{ playerId: 'p1' }, { playerId: 'p2', ready: true }, { playerId: 'p3', ready: false }]
    })
    const wrapper = mountControls()

    expect(wrapper.find('[data-testid="start-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="start-hint"]').text()).toBe(
      'waiting for everyone to ready up'
    )
  })

  it('enables start with 2+ seats and every non-host seat ready (host itself unready)', async () => {
    const store = makeStore({
      selfId: 'p1',
      hostId: 'p1',
      seats: [
        { playerId: 'p1', ready: false },
        { playerId: 'p2', ready: true }
      ]
    })
    const wrapper = mountControls()

    const start = wrapper.find('[data-testid="start-button"]')
    expect(start.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="start-hint"]').exists()).toBe(false)

    await start.trigger('click')
    expect(store.startMatch).toHaveBeenCalledTimes(1)
  })

  it('surfaces a server-side not_ready rejection through the hint', () => {
    const store = makeStore({
      selfId: 'p1',
      hostId: 'p1',
      seats: [{ playerId: 'p1' }, { playerId: 'p2', ready: true }]
    })
    store.lastError = { code: 'not_ready', message: 'not ready' }
    const wrapper = mountControls()

    expect(wrapper.find('[data-testid="start-hint"]').text()).toBe(
      'waiting for everyone to ready up'
    )
  })
})

describe('RoomControls — non-host', () => {
  it('hides the host-only start button and offers ready instead', async () => {
    const store = makeStore({
      selfId: 'p2',
      hostId: 'p1',
      seats: [{ playerId: 'p1' }, { playerId: 'p2', ready: false }]
    })
    const wrapper = mountControls()

    expect(wrapper.find('[data-testid="start-button"]').exists()).toBe(false)
    const ready = wrapper.find('[data-testid="ready-button"]')
    expect(ready.exists()).toBe(true)
    expect(ready.attributes('disabled')).toBeUndefined()

    await ready.trigger('click')
    expect(store.setReady).toHaveBeenCalledTimes(1)
    expect(store.setReady).toHaveBeenCalledWith(true)
  })

  it('toggles to un-ready once the own seat is ready (Δ1)', async () => {
    const store = makeStore({
      selfId: 'p2',
      hostId: 'p1',
      seats: [{ playerId: 'p1' }, { playerId: 'p2', ready: true }]
    })
    const wrapper = mountControls()

    const ready = wrapper.find('[data-testid="ready-button"]')
    expect(ready.attributes('disabled')).toBeUndefined() // stays clickable
    await ready.trigger('click')
    expect(store.setReady).toHaveBeenCalledWith(false)
  })
})
