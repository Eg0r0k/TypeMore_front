/**
 * Opponents rail: per-peer nick + wpm and a status badge once a peer leaves
 * `racing` — no progress bar or ghost field (live positions race as ghost
 * carets inside the local field). A desynced peer must get the distinct
 * "out of sync" treatment (frozen-ghost styling), never be silently hidden;
 * an eliminated peer must carry WHY it is out, since the wire only ever says
 * "finished".
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { OpponentsRail } from '@/features/room/match'
import type { PeerRailEntry } from '@/entities/lobby'
import { i18n } from '@app/i18n'

function makePeers(): PeerRailEntry[] {
  return [
    {
      playerId: 'p2',
      nick: 'Neo',
      metrics: { wpm: 92.6, acc: 0.98, progress: 0.5 },
      status: 'racing'
    },
    {
      playerId: 'p3',
      nick: 'Smith',
      metrics: { wpm: 44.2, acc: 0.91, progress: 0.31 },
      status: 'desynced'
    },
    {
      playerId: 'p4',
      nick: 'Morpheus',
      metrics: { wpm: 88, acc: 0.99, progress: 1 },
      status: 'finished'
    },
    {
      playerId: 'p5',
      nick: 'Cypher',
      metrics: { wpm: 31.4, acc: 0.72, progress: 0.18 },
      status: 'eliminated',
      failReason: 'master'
    }
  ]
}

const mountRail = (peers: PeerRailEntry[] = makePeers()) =>
  mount(OpponentsRail, { global: { plugins: [i18n] }, props: { peers } })

describe('OpponentsRail — peer status badges', () => {
  it('shows no badge for a racing peer, and its rounded wpm', () => {
    const wrapper = mountRail()

    const racing = wrapper.find('[data-peer-status="racing"]')
    expect(racing.exists()).toBe(true)
    expect(racing.find('[data-testid="peer-badge"]').exists()).toBe(false)
    expect(racing.text()).toContain('93 wpm')
  })

  it('renders no per-peer progress bar (positions live as ghost carets in the field)', () => {
    const wrapper = mountRail()

    expect(wrapper.find('.opponent__progress').exists()).toBe(false)
    expect(wrapper.find('[data-slot="progress-fill-indicator"]').exists()).toBe(false)
  })

  it('marks a desynced peer with the distinct out-of-sync badge and frozen-ghost styling', () => {
    const wrapper = mountRail()

    const desynced = wrapper.find('[data-peer-status="desynced"]')
    expect(desynced.exists()).toBe(true)
    expect(desynced.classes()).toContain('opponent--desynced')

    const badge = desynced.find('[data-testid="peer-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('out of sync')
    expect(badge.classes()).toContain('opponent__badge--desynced')
  })

  it('badges a finished peer without the out-of-sync treatment', () => {
    const wrapper = mountRail()

    const finished = wrapper.find('[data-peer-status="finished"]')
    expect(finished.find('[data-testid="peer-badge"]').text()).toBe('finished')
    expect(finished.classes()).not.toContain('opponent--desynced')
  })

  it('badges an eliminated peer with its reason and the out styling', () => {
    const wrapper = mountRail()

    const eliminated = wrapper.find('[data-peer-status="eliminated"]')
    expect(eliminated.exists()).toBe(true)
    expect(eliminated.classes()).toContain('opponent--eliminated')
    expect(eliminated.classes()).toContain('opponent--out')
    expect(eliminated.classes()).not.toContain('opponent--desynced')

    const badge = eliminated.find('[data-testid="peer-badge"]')
    expect(badge.text()).toBe('out · master')
    expect(badge.classes()).toContain('opponent__badge--eliminated')
  })

  it('names the freemod floor by its copy, not its reason id', () => {
    const wrapper = mountRail([
      {
        playerId: 'p6',
        nick: 'Tank',
        metrics: { wpm: 12, acc: 0.9, progress: 0.05 },
        status: 'eliminated',
        failReason: 'minSpeed'
      }
    ])

    expect(wrapper.find('[data-testid="peer-badge"]').text()).toBe('out · min speed')
  })
})
