/**
 * The 3-2-1 countdown locks the field's INPUT side out.
 *
 * The session store already voids every sink call before GO (phase gate,
 * covered by match/countdown-input.test.ts) — but the input adapter's side
 * effects are not store calls: the click/error samples play on the keystroke
 * itself, so typing over the countdown was audible. The match surface passes
 * `input-disabled` while the phase is `countdown`; the widget then mounts no
 * adapter at all, and re-arms it on GO so the first real keystroke types.
 *
 * The session store is a hand-built reactive stub — no Pinia, no transport
 * (same shape as match-visual-mods.test.ts).
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({
  store: {} as unknown,
  config: {} as Record<string, unknown>
}))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.store
}))
vi.mock('@/entities/config/model/store', () => ({
  useConfigStore: () => ({ config: h.config })
}))
// The widget's own lockout behavior is covered below with the real component;
// here only the phase → prop contract is under test.
vi.mock('@/widgets/test', () => ({
  Test: {
    name: 'FieldStub',
    props: ['store', 'ghosts', 'inputDisabled', 'fading', 'flashlight', 'caretStyle', 'smoothCaret'],
    template: '<div class="field-stub" />'
  }
}))

import { RoomMatch } from '@/features/room/match'

const selfView = () =>
  reactive({
    snapshot: { phase: 'idle', wordIndex: 0, input: [''], startedAt: 0, finishedAt: null },
    words: ['alpha', 'beta'],
    wordIndex: 0,
    finished: false,
    blind: false
  })

function mountMatch(phase: string, countdownMsLeft: number | null = null) {
  h.config = {
    blind: false,
    fading: false,
    flashlight: false,
    caretStyle: 'default',
    smoothCaret: 'medium'
  }
  h.store = reactive({
    selfView: selfView(),
    selfHud: { score: 0, combo: 0, multiplier: 1, modMultiplier: 1, wpm: 0, raw: 0 },
    peers: [],
    phase,
    countdownMsLeft,
    selfOutcome: null,
    standings: [],
    matchDurationMs: null,
    matchElapsedMs: 0,
    afkProgress: 0
  })
  return mount(RoomMatch, { global: { plugins: [i18n] } })
}

describe('match surface — countdown input lockout', () => {
  it('disables the field input during the countdown', () => {
    const wrapper = mountMatch('countdown', 2000)
    expect(wrapper.findComponent({ name: 'FieldStub' }).props('inputDisabled')).toBe(true)
    wrapper.unmount()
  })

  it('re-enables it on GO', async () => {
    const wrapper = mountMatch('countdown', 2000)
    const store = h.store as { phase: string; countdownMsLeft: number | null }
    store.phase = 'running'
    store.countdownMsLeft = null
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'FieldStub' }).props('inputDisabled')).toBe(false)
    wrapper.unmount()
  })
})
