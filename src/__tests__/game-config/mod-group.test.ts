/**
 * The shared icon-only mod group, used by the solo bar and the room panel.
 *
 * Two things here are worth a test rather than a reading. A button with no text
 * has to say what it is some other way, and a group that renders only PART of
 * the mods must report only that part — otherwise the caller, folding the answer
 * over everything it owns, silently clears the mods a different group is
 * responsible for.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { i18n } from '@app/i18n'
import { ModGroup, optionOf, type GameOption } from '@/entities/game'

const TEXT_MODS: GameOption[] = [optionOf('punctuation'), optionOf('numbers')]

const mountGroup = (props: Record<string, unknown> = {}) =>
  mount(ModGroup, {
    props: {
      options: TEXT_MODS,
      active: [],
      label: 'text',
      groupAriaLabel: 'text modifiers',
      ...props
    },
    global: { plugins: [i18n] }
  })

const buttons = (wrapper: ReturnType<typeof mountGroup>) => wrapper.findAll('button')

describe('ModGroup', () => {
  it('renders an icon per option and no visible label on it', () => {
    const wrapper = mountGroup()

    expect(buttons(wrapper)).toHaveLength(TEXT_MODS.length)
    for (const button of buttons(wrapper)) {
      expect(button.find('svg').exists()).toBe(true)
      expect(button.text()).toBe('')
    }
  })

  it('names every icon-only button for a screen reader and for a pointer', () => {
    const wrapper = mountGroup()

    const first = buttons(wrapper)[0]
    expect(first.attributes('aria-label')).toBe(i18n.global.t('game.punctuation'))
    expect(first.attributes('title')).toBe(i18n.global.t('game.punctuation'))
  })

  it('reports only its OWN keys, so a caller cannot clear another group', () => {
    // `active` deliberately carries a key this group does not render — as it
    // does in the bar, where one list of active mods feeds every group.
    const wrapper = mountGroup({ active: ['punctuation', 'flashlight'] })

    buttons(wrapper)[1].trigger('click')

    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([['punctuation', 'numbers']])
  })

  it('keeps a gated mod at its stored value instead of clearing it', () => {
    // A disabled item can never appear in the incoming selection; writing that
    // absence back would turn "you cannot change this now" into "this is off".
    const wrapper = mountGroup({
      active: ['punctuation', 'numbers'],
      disabledReason: (option: GameOption) =>
        option.key === 'punctuation' ? 'game.constraint.fixedText' : null
    })

    const [gated, free] = buttons(wrapper)
    expect(gated.attributes('disabled')).toBeDefined()
    expect(gated.attributes('title')).toContain(i18n.global.t('game.constraint.fixedText'))

    free.trigger('click')

    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([['punctuation']])
  })

  it('renders nothing at all when the context offers no mods', () => {
    const wrapper = mountGroup({ options: [] })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})
