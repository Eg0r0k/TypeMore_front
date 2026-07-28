/**
 * The race rail: every seat (self included) ranked by live points, a FLIP
 * reorder on position swaps, and an evaporating ✕ over the player whose streak
 * just broke. The session store is a hand-built reactive stub, same shape as
 * the other room specs — the rail reads `selfHud`, `peers`, `selfId` and
 * `room` and nothing else.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.store
}))

import RaceRail from '@/features/room/match/race-rail.vue'

interface PeerStub {
  playerId: string
  nick: string
  points: number
  combo: number
  status: string
}

function makeStore(peers: PeerStub[], selfPoints = 100, selfCombo = 7) {
  return reactive({
    selfId: 'me',
    room: { players: [{ playerId: 'me', nick: 'egor' }] },
    // The rail multiplies score × modMultiplier itself — mirror the HUD shape.
    selfHud: {
      score: selfPoints,
      combo: selfCombo,
      multiplier: 1,
      modMultiplier: 1,
      wpm: 0,
      raw: 0
    },
    peers
  })
}

const rowIds = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-testid^="race-row-"]').map((row) => row.attributes('data-testid'))

const racing = (over: Partial<PeerStub> & { playerId: string; nick: string }): PeerStub => ({
  points: 0,
  combo: 0,
  status: 'racing',
  ...over
})

describe('race rail', () => {
  it('ranks every seat by points, self included and marked', () => {
    h.store = makeStore([
      racing({ playerId: 'p1', nick: 'alice', points: 250, combo: 12 }),
      racing({ playerId: 'p2', nick: 'bob', points: 40 })
    ])
    const wrapper = mount(RaceRail)

    expect(rowIds(wrapper)).toEqual(['race-row-p1', 'race-row-me', 'race-row-p2'])
    expect(wrapper.find('[data-testid="race-row-me"]').classes()).toContain('race-rail__row--you')
    // Rank numbers follow the sorted order, not the wire order.
    expect(wrapper.find('[data-testid="race-row-p1"] .race-rail__rank').text()).toBe('1')
    expect(wrapper.find('[data-testid="race-row-p2"] .race-rail__rank').text()).toBe('3')
  })

  it('reorders when a peer overtakes', async () => {
    const store = makeStore([racing({ playerId: 'p1', nick: 'alice', points: 50 })])
    h.store = store
    const wrapper = mount(RaceRail)
    expect(rowIds(wrapper)).toEqual(['race-row-me', 'race-row-p1'])

    store.peers[0].points = 500
    await nextTick()
    expect(rowIds(wrapper)).toEqual(['race-row-p1', 'race-row-me'])
  })

  it('spawns an evaporating cross over the seat whose streak broke', async () => {
    const store = makeStore([racing({ playerId: 'p1', nick: 'alice', points: 250, combo: 12 })])
    h.store = store
    const wrapper = mount(RaceRail)
    expect(wrapper.findAll('[data-testid="streak-cross"]')).toHaveLength(0)

    store.peers[0].combo = 0
    await nextTick()
    const crosses = wrapper.findAll('[data-testid="streak-cross"]')
    expect(crosses).toHaveLength(1)
    expect(
      wrapper.find('[data-testid="race-row-p1"]').find('[data-testid="streak-cross"]').exists()
    ).toBe(true)
  })

  it('stays quiet on a low-combo typo — nothing was really lost', async () => {
    const store = makeStore([racing({ playerId: 'p1', nick: 'alice', combo: 2 })])
    h.store = store
    const wrapper = mount(RaceRail)

    store.peers[0].combo = 0
    await nextTick()
    expect(wrapper.findAll('[data-testid="streak-cross"]')).toHaveLength(0)
  })

  it('renders nothing for a lone seat — one player is not a race', () => {
    h.store = makeStore([])
    const wrapper = mount(RaceRail)
    expect(wrapper.find('[data-testid="race-rail"]').exists()).toBe(false)
  })

  it('dims a seat that is out but keeps its points on the board', () => {
    h.store = makeStore([
      racing({ playerId: 'p1', nick: 'alice', points: 250, status: 'left' })
    ])
    const wrapper = mount(RaceRail)
    const row = wrapper.find('[data-testid="race-row-p1"]')
    expect(row.classes()).toContain('race-rail__row--out')
    expect(row.find('.race-rail__points').text()).toBe('250')
  })
})
