/**
 * The seat list's way into a player's profile.
 *
 * One rule decides everything here: the card is addressed by the seat's NICK,
 * and for a seated account that nick IS the account's display name. A guest has
 * no account, so there is nothing to address — and a control that opens an
 * empty card is worse than a plain label. That distinction is the test.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h as createElement, reactive } from 'vue'

import { i18n } from '@app/i18n'
import { TooltipProvider } from '@/shared/ui/tooltip'

const h = vi.hoisted(() => ({ store: {} as unknown }))

vi.mock('@/entities/match', () => ({ useMatchSessionStore: () => h.store }))

// The card fetches; this test is about who gets one, not about what it says.
vi.mock('@/features/profile', () => ({
  ProfileMiniCard: { name: 'ProfileMiniCard', props: ['name'], template: '<div data-mini />' }
}))

import { RoomPlayers } from '@/features/room/players'

const seat = (nick: string, isGuest: boolean) => ({
  playerId: nick,
  nick,
  isGuest,
  ready: false,
  freemods: { difficulty: 'normal', minWpm: 0, nospace: false }
})

const mountList = () => {
  h.store = reactive({
    room: {
      code: 'ABCDEF',
      name: 'room',
      visibility: 'open',
      hostPlayerId: 'ada',
      settings: { visibility: 'open' },
      players: [seat('ada', false), seat('Guest-0420', true)]
    },
    selfId: 'ada',
    isHost: true,
    transferHost: vi.fn(),
    kickPlayer: vi.fn()
  })
  // The seat list carries tooltips (the room code, the host actions) and has
  // always expected the room page's provider above it — the app mounts it that
  // way, so the test does too.
  const Host = defineComponent({
    setup: () => () => createElement(TooltipProvider, null, () => createElement(RoomPlayers))
  })
  return mount(Host, { global: { plugins: [i18n] } })
}

describe('lobby seat → profile', () => {
  it('turns an account nick into a control and leaves a guest nick alone', () => {
    const wrapper = mountList()
    const triggers = wrapper.findAll('[data-testid="seat-profile-trigger"]')

    expect(triggers).toHaveLength(1)
    expect(triggers[0]!.text()).toBe('ada')
    // The guest is still on screen — just not as a way into a profile.
    expect(wrapper.text()).toContain('Guest-0420')
  })

  it('mounts nothing until the seat is actually asked about', () => {
    // Five seats must not be five profile requests on render: the card lives
    // in the popover's content, which reka only mounts while it is open.
    const wrapper = mountList()
    expect(wrapper.findComponent({ name: 'ProfileMiniCard' }).exists()).toBe(false)
  })
})
