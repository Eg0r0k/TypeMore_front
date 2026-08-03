/**
 * GameView seam acceptance: the game field renders against a HAND-BUILT
 * reactive view-model — no Pinia, no GameCore, no store factory. This is the
 * contract ghosts rely on: anything satisfying `GameView` is renderable.
 */
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia } from 'pinia'

import { Test } from '@/widgets/test'
import type { GameView } from '@entities/game'
import { type GameState, asMs, asSeq } from '@typemore/core'
import { SMOOTH_CARET_MS } from '@/widgets/test/game-styles'
import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/app/i18n/locales/en'

config.global.plugins.push(createI18n({ legacy: false, locale: 'en', messages: { en } }))

interface MutableView {
  snapshot: GameState
  words: readonly string[]
  wordIndex: number
  finished: boolean
  blind: boolean
}

function makeView(): GameView & MutableView {
  return reactive<MutableView>({
    snapshot: {
      phase: 'running',
      wordIndex: 0,
      input: ['he'],
      startedAt: asMs(0),
      finishedAt: null,
      lastSeq: asSeq(2),
      failReason: null
    },
    words: ['hello', 'world'],
    wordIndex: 0,
    finished: false,
    blind: false
  })
}

const mountField = (view: GameView) =>
  mount(Test, {
    props: { store: view, viewOnly: true, shadowMode: 'open' as const },
    attachTo: document.body
  })

describe('GameField over a plain GameView (no Pinia)', () => {
  it('renders words, typed letters, and the caret from a hand-built view-model', async () => {
    const view = makeView()
    const wrapper = mountField(view)
    await nextTick()
    await nextTick() // shadow mount -> Teleport -> geometry pass

    const root = (wrapper.find('.game__host').element as HTMLElement).shadowRoot
    expect(root).not.toBeNull()

    const words = root?.querySelectorAll('.word') ?? []
    expect(words).toHaveLength(2)
    // Active word derived from the view's wordIndex.
    expect(words[0]?.classList.contains('active')).toBe(true)
    // Typed buffer 'he' marks the first two letters correct.
    const letters = words[0]?.querySelectorAll('.letter') ?? []
    expect(letters[0]?.classList.contains('correct')).toBe(true)
    expect(letters[1]?.classList.contains('correct')).toBe(true)
    expect(letters[2]?.classList.contains('correct')).toBe(false)
    // (The caret element itself is covered by the caret-styles suite below; its
    // SIZE is not assertable under happy-dom's zero-size layout.)
    // No input adapter is mounted in view-only mode.
    expect(wrapper.find('textarea').exists()).toBe(false)

    wrapper.unmount()
  })

  it('tracks view-model mutations reactively (a ghost advancing a word)', async () => {
    const view = makeView()
    const wrapper = mountField(view)
    await nextTick()
    await nextTick()

    view.snapshot = { ...view.snapshot, wordIndex: 1, input: ['hello', 'w'], lastSeq: asSeq(8) }
    view.wordIndex = 1
    await nextTick()

    const root = (wrapper.find('.game__host').element as HTMLElement).shadowRoot
    const words = root?.querySelectorAll('.word') ?? []
    expect(words[0]?.classList.contains('active')).toBe(false)
    expect(words[1]?.classList.contains('active')).toBe(true)

    wrapper.unmount()
  })

  it('honors blind from the view, not from any global config', async () => {
    const view = makeView()
    view.blind = true
    view.snapshot = { ...view.snapshot, input: ['hx'] } // a typo that blind must mask
    const wrapper = mountField(view)
    await nextTick()
    await nextTick()

    const root = (wrapper.find('.game__host').element as HTMLElement).shadowRoot
    const letters = root?.querySelectorAll('.word')[0]?.querySelectorAll('.letter') ?? []
    expect(letters[1]?.classList.contains('incorrect')).toBe(false)

    wrapper.unmount()
  })
})

/**
 * A field with no words is not playable. The hidden textarea owns the keyboard
 * as soon as it mounts, so a session whose words never arrived (dictionary load
 * failed) must not mount it — otherwise the player types into an empty screen.
 */
describe('GameField with no words', () => {
  const makeSession = (words: readonly string[]): GameView & MutableView =>
    Object.assign(reactive<MutableView>({ ...makeView(), words, snapshot: makeView().snapshot }), {
      insert: () => undefined,
      replace: () => undefined,
      deleteBackward: () => undefined,
      commit: () => undefined
    })

  const mountPlayable = (session: GameView) =>
    mount(Test, {
      props: { store: session, shadowMode: 'open' as const },
      global: { plugins: [createPinia()] },
      attachTo: document.body
    })

  it('mounts no input adapter and no focus hint while the word list is empty', async () => {
    const session = makeSession([])
    const wrapper = mountPlayable(session)
    await nextTick()
    await nextTick()

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('.game__focus-hint').exists()).toBe(false)

    wrapper.unmount()
  })

  it('arms the input once words arrive (a retry after a failed load)', async () => {
    const session = makeSession([])
    const wrapper = mountPlayable(session)
    await nextTick()
    expect(wrapper.find('textarea').exists()).toBe(false)

    session.words = ['hello', 'world']
    await nextTick()
    await nextTick()

    expect(wrapper.find('textarea').exists()).toBe(true)

    wrapper.unmount()
  })
})

/**
 * `inputDisabled` (match countdown lockout): the field stays live — words and
 * ghosts render — but no input adapter exists, so a keystroke produces neither
 * state changes nor sound feedback. When the lockout lifts (GO), the adapter
 * mounts AND arms itself: the first real keystroke must type, not re-arm.
 */
describe('GameField with inputDisabled', () => {
  const makeSession = (): GameView & MutableView =>
    Object.assign(makeView(), {
      insert: () => undefined,
      replace: () => undefined,
      deleteBackward: () => undefined,
      commit: () => undefined
    })

  const mountLocked = (session: GameView) =>
    mount(Test, {
      props: { store: session, inputDisabled: true, shadowMode: 'open' as const },
      global: { plugins: [createPinia()] },
      attachTo: document.body
    })

  it('mounts no input adapter and no focus hint while disabled', async () => {
    const wrapper = mountLocked(makeSession())
    await flushPromises()

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('.game__focus-hint').exists()).toBe(false)

    wrapper.unmount()
  })

  it('mounts AND focuses the adapter when the lockout lifts', async () => {
    const wrapper = mountLocked(makeSession())
    await flushPromises()

    await wrapper.setProps({ inputDisabled: false })
    await flushPromises()

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(document.activeElement).toBe(textarea.element)

    wrapper.unmount()
  })
})

/**
 * Caret styles are PROPS, not config: the field draws whatever shape it is told
 * to, and a ghost/replay view keeps the defaults. happy-dom reports zero
 * geometry, so only the element, its modifier class and the geometry/timing vars
 * are assertable — the shapes themselves are pure CSS in the shadow stylesheet.
 *
 * The caret appears only after the mount's async geometry pass (mountShadow ->
 * Teleport -> two nextTicks inside an async onMounted), hence flushPromises
 * rather than a fixed number of ticks.
 */
describe('GameField caret styles', () => {
  const shadowOf = (wrapper: VueWrapper): ShadowRoot | null =>
    (wrapper.find('.game__host').element as HTMLElement).shadowRoot

  const mountWithCaret = (props: Record<string, unknown>) =>
    mount(Test, {
      props: { store: makeView(), viewOnly: true, shadowMode: 'open' as const, ...props },
      attachTo: document.body
    })

  it('defaults to the thin bar when nothing is passed', async () => {
    const wrapper = mountField(makeView())
    await flushPromises()

    const caret = shadowOf(wrapper)?.querySelector('.game__caret')
    expect(caret?.classList.contains('game__caret--default')).toBe(true)

    wrapper.unmount()
  })

  it.each(['default', 'block', 'outline', 'underline'] as const)(
    'draws %s as its own modifier class',
    async (style) => {
      const wrapper = mountWithCaret({ caretStyle: style })
      await flushPromises()

      const carets = shadowOf(wrapper)?.querySelectorAll('.game__caret') ?? []
      expect(carets).toHaveLength(1)
      expect(carets[0]?.classList.contains(`game__caret--${style}`)).toBe(true)

      wrapper.unmount()
    }
  )

  it('renders no caret element at all when the style is off', async () => {
    const wrapper = mountWithCaret({ caretStyle: 'off' })
    await flushPromises()

    expect(shadowOf(wrapper)?.querySelectorAll('.game__caret')).toHaveLength(0)

    wrapper.unmount()
  })

  it('exposes the smooth-caret duration as a CSS var (off = instant)', async () => {
    const fast = mountWithCaret({ smoothCaret: 'fast' })
    const off = mountWithCaret({ smoothCaret: 'off' })
    await flushPromises()

    const styleOf = (w: VueWrapper): string =>
      shadowOf(w)?.querySelector('.game__caret')?.getAttribute('style') ?? ''
    expect(styleOf(fast)).toContain(`--tm-caret-ms: ${SMOOTH_CARET_MS.fast}ms`)
    expect(styleOf(off)).toContain('--tm-caret-ms: 0ms')

    fast.unmount()
    off.unmount()
  })
})
