/**
 * Lobby controls against the match-session contract (§3 `start_match` gating):
 * the start button is host-only and only actually starts with ≥2 seats and
 * every non-host seat ready — a press that cannot start explains itself in a
 * toast; non-hosts get a ready/un-ready toggle (Δ1).
 * The session store is a hand-built reactive stub — no Pinia, no transport.
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { reactive } from 'vue'

import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({ store: {} as unknown }))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.store
}))

vi.mock('@/shared/ui/sonner', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }
}))

import { toast } from '@/shared/ui/sonner'

beforeEach(() => vi.mocked(toast.warning).mockClear())

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

/**
 * The gate is §3's — two seats, every non-host seat ready — but it is no longer
 * a DISABLED button with standing small print under it. The button always
 * presses; a press that cannot start the match says why, once, as a toast. So
 * what these assert is the toast and the absence of `start_match`, not an
 * attribute.
 */
describe('RoomControls — start gating (host)', () => {
  it('refuses a single-seat start and says what is missing', async () => {
    const store = makeStore({ selfId: 'p1', hostId: 'p1', seats: [{ playerId: 'p1' }] })
    const wrapper = mountControls()

    await wrapper.find('[data-testid="start-button"]').trigger('click')

    expect(store.startMatch).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('waiting for at least one more player')
  })

  it('refuses to start while any non-host seat is unready', async () => {
    const store = makeStore({
      selfId: 'p1',
      hostId: 'p1',
      seats: [{ playerId: 'p1' }, { playerId: 'p2', ready: true }, { playerId: 'p3', ready: false }]
    })
    const wrapper = mountControls()

    await wrapper.find('[data-testid="start-button"]').trigger('click')

    expect(store.startMatch).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('waiting for everyone to ready up')
  })

  it('starts with 2+ seats and every non-host seat ready (host itself unready)', async () => {
    const store = makeStore({
      selfId: 'p1',
      hostId: 'p1',
      seats: [
        { playerId: 'p1', ready: false },
        { playerId: 'p2', ready: true }
      ]
    })
    const wrapper = mountControls()

    await wrapper.find('[data-testid="start-button"]').trigger('click')

    expect(store.startMatch).toHaveBeenCalledTimes(1)
    expect(toast.warning).not.toHaveBeenCalled()
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
