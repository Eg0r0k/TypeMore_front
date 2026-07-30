/**
 * Input adapter × log v2 telemetry: the physical key stream is captured through
 * the same pipeline as the text path, in DOM order — `down` strictly before the
 * `insert` it produces, `up` after it — with auto-repeats skipped and
 * composition sessions suppressed entirely.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia } from 'pinia'

import { TestInput } from '@/features/test/input'
import type { GameSession } from '@entities/game'
import { asMs, asSeq, type GameState } from '@typemore/core'

const state = (): GameState => ({
  phase: 'running',
  wordIndex: 0,
  input: [''],
  startedAt: asMs(0),
  finishedAt: null,
  lastSeq: asSeq(1),
  failReason: null
})

interface Recorded {
  readonly calls: string[]
}

const makeSession = (): GameSession & Recorded => {
  const calls: string[] = []
  return reactive({
    calls,
    snapshot: state(),
    words: ['alpha', 'bravo'],
    wordIndex: 0,
    finished: false,
    blind: false,
    insert: vi.fn((text: string) => calls.push(`insert:${text}`)),
    replace: vi.fn(),
    deleteBackward: vi.fn(() => calls.push('delete')),
    commit: vi.fn(() => calls.push('commit')),
    keyDown: vi.fn((code: string) => calls.push(`down:${code}`)),
    keyUp: vi.fn((code: string) => calls.push(`up:${code}`))
  }) as unknown as GameSession & Recorded
}

const mountInput = (session: GameSession) =>
  mount(TestInput, {
    props: { store: session },
    global: { plugins: [createPinia()] },
    attachTo: document.body
  })

describe('telemetry capture in the input adapter', () => {
  it('down precedes its insert; up follows it', async () => {
    const session = makeSession()
    const wrapper = mountInput(session)
    const area = wrapper.find('textarea')
    await area.trigger('keydown', { key: 'a', code: 'KeyA' })
    await area.trigger('beforeinput', { inputType: 'insertText', data: 'a' })
    await area.trigger('keyup', { key: 'a', code: 'KeyA' })
    expect(session.calls).toEqual(['down:KeyA', 'insert:a', 'up:KeyA'])
    wrapper.unmount()
  })

  it('modifier holds are captured and can overlap', async () => {
    const session = makeSession()
    const wrapper = mountInput(session)
    const area = wrapper.find('textarea')
    await area.trigger('keydown', { key: 'Shift', code: 'ShiftLeft' })
    await area.trigger('keydown', { key: 'A', code: 'KeyA' })
    await area.trigger('beforeinput', { inputType: 'insertText', data: 'A' })
    await area.trigger('keyup', { key: 'A', code: 'KeyA' })
    await area.trigger('keyup', { key: 'Shift', code: 'ShiftLeft' })
    expect(session.calls).toEqual([
      'down:ShiftLeft',
      'down:KeyA',
      'insert:A',
      'up:KeyA',
      'up:ShiftLeft'
    ])
    wrapper.unmount()
  })

  it('auto-repeat keydowns are skipped: a hold is one pair', async () => {
    const session = makeSession()
    const wrapper = mountInput(session)
    const area = wrapper.find('textarea')
    await area.trigger('keydown', { key: 'a', code: 'KeyA' })
    await area.trigger('keydown', { key: 'a', code: 'KeyA', repeat: true })
    await area.trigger('keydown', { key: 'a', code: 'KeyA', repeat: true })
    await area.trigger('keyup', { key: 'a', code: 'KeyA' })
    expect(session.calls).toEqual(['down:KeyA', 'up:KeyA'])
    wrapper.unmount()
  })

  it('composition sessions record no telemetry', async () => {
    const session = makeSession()
    const wrapper = mountInput(session)
    const area = wrapper.find('textarea')
    await area.trigger('keydown', { key: 'a', code: 'KeyA', isComposing: true })
    await area.trigger('keyup', { key: 'a', code: 'KeyA', isComposing: true })
    expect(session.calls).toEqual([])
    wrapper.unmount()
  })

  it('an empty code records nothing', async () => {
    const session = makeSession()
    const wrapper = mountInput(session)
    const area = wrapper.find('textarea')
    await area.trigger('keydown', { key: 'Process', code: '' })
    await area.trigger('keyup', { key: 'Process', code: '' })
    expect(session.calls).toEqual([])
    wrapper.unmount()
  })

  it('the space commit still records its physical pair', async () => {
    const session = makeSession()
    const wrapper = mountInput(session)
    const area = wrapper.find('textarea')
    await area.trigger('keydown', { key: ' ', code: 'Space' })
    await area.trigger('keyup', { key: ' ', code: 'Space' })
    expect(session.calls).toEqual(['down:Space', 'commit', 'up:Space'])
    wrapper.unmount()
  })
})
