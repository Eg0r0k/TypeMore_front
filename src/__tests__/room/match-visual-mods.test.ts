/**
 * The personal visual mods reach the field in a MATCH, not only in solo.
 *
 * PROTOCOL.md §5 keeps blind / fading / flashlight off the wire: they leave no
 * trace in the event log, so the server cannot verify them and they never
 * multiply a match score. That is the reason they are not freemods — it is not
 * a reason to take them away from the player who switched them on. All three
 * only ever HIDE information, so there is nothing to guard against.
 *
 * `blind` already arrived through `selfView` (the session reads it off config),
 * which is what made the omission a bug rather than a decision: fading and
 * flashlight are CSS mods carried as field props and were simply never passed.
 *
 * The session store is a hand-built reactive stub — no Pinia, no transport
 * (same shape as eliminated-panel.test.ts).
 */
import { mount, type VueWrapper } from '@vue/test-utils'
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
// The field is covered by its own specs; only the contract between the match
// surface and the field is under test, so the widget is replaced wholesale —
// an SFC takes its name from its filename, so a `stubs: { Test }` never matches.
vi.mock('@/widgets/test', () => ({
  Test: {
    name: 'FieldStub',
    props: ['store', 'ghosts', 'fading', 'flashlight', 'caretStyle', 'smoothCaret'],
    template: '<div class="field-stub" />'
  }
}))

import { RoomMatch } from '@/features/room/match'

/** A minimal `GameView` — enough for the field to mount. */
const selfView = () =>
  reactive({
    snapshot: { phase: 'running', wordIndex: 0, input: [''], startedAt: 0, finishedAt: null },
    words: ['alpha', 'beta'],
    wordIndex: 0,
    finished: false,
    blind: false
  })

function mountMatch(config: Record<string, unknown>) {
  h.config = {
    blind: false,
    fading: false,
    flashlight: false,
    caretStyle: 'default',
    smoothCaret: 'medium',
    ...config
  }
  h.store = reactive({
    selfView: selfView(),
    peers: [],
    phase: 'running',
    countdownMsLeft: null,
    selfOutcome: null,
    standings: [],
    matchDurationMs: null,
    matchElapsedMs: 0
  })
  return mount(RoomMatch, {
    global: {
      plugins: [i18n]
    }
  })
}

const fieldProps = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'FieldStub' }).props()

describe('a match field honours the local player’s visual mods', () => {
  it('passes fading through when the player has it on', () => {
    const wrapper = mountMatch({ fading: true })
    expect(fieldProps(wrapper).fading).toBe(true)
    wrapper.unmount()
  })

  it('passes flashlight through when the player has it on', () => {
    const wrapper = mountMatch({ flashlight: true })
    expect(fieldProps(wrapper).flashlight).toBe(true)
    wrapper.unmount()
  })

  it('passes both, and leaves them off when they are off', () => {
    const on = mountMatch({ fading: true, flashlight: true })
    expect(fieldProps(on)).toMatchObject({ fading: true, flashlight: true })
    on.unmount()

    const off = mountMatch({})
    expect(fieldProps(off)).toMatchObject({ fading: false, flashlight: false })
    off.unmount()
  })

  it('still carries the caret settings it always did', () => {
    const wrapper = mountMatch({ caretStyle: 'block', smoothCaret: 'fast' })
    expect(fieldProps(wrapper)).toMatchObject({ caretStyle: 'block', smoothCaret: 'fast' })
    wrapper.unmount()
  })
})
