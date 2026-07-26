/**
 * A tab is INDENTATION, not a narrow glyph.
 *
 * Reported as "таб не делает отступ" — the arrow rendered at the width of one
 * character, so an indented code line started barely right of the margin and
 * nothing lined up. Independent of the newline rule: even with the targets cut
 * correctly (a tab only ever OPENS a target — see `code-layout.test.ts`), the
 * tab still has to occupy a tab stop for the line to be indented.
 *
 * It stays one measurable letter box rather than padding on the word, because
 * the caret is drawn from the box it sits on: an indent faked with margin would
 * leave the caret at the old x while the glyph moved.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { TestWord } from '@/features/test/word'

describe('the tab that opens a line is marked as a tab stop', () => {
  it('marks a leading tab', () => {
    const wrapper = mount(TestWord, { props: { word: '\ttext-align:', typed: '', active: false } })
    const tab = wrapper.findAll('.letter')[0]

    expect(tab.text()).toBe('→')
    expect(tab.classes()).toContain('letter--tab')
    // Still whitespace: it keeps the dimmed treatment the newline glyph has.
    expect(tab.classes()).toContain('letter--ws')
  })

  it('marks every tab of a deeper indent', () => {
    const wrapper = mount(TestWord, { props: { word: '\t\tnested', typed: '', active: false } })
    const tabs = wrapper.findAll('.letter').filter((l) => l.classes().includes('letter--tab'))

    expect(tabs).toHaveLength(2)
  })

  it('does not call a newline a tab stop', () => {
    const wrapper = mount(TestWord, { props: { word: '{\n', typed: '', active: false } })
    const nl = wrapper.findAll('.letter')[1]

    expect(nl.text()).toBe('↵')
    expect(nl.classes()).toContain('letter--ws')
    expect(nl.classes()).not.toContain('letter--tab')
  })

  it('leaves an ordinary letter unmarked', () => {
    const wrapper = mount(TestWord, { props: { word: 'p.center', typed: '', active: false } })
    const letter = wrapper.findAll('.letter')[0]

    expect(letter.classes()).not.toContain('letter--ws')
    expect(letter.classes()).not.toContain('letter--tab')
  })

  it('marks a tab typed as an EXTRA character too, so the caret keeps its width', () => {
    // Over-typing past the target still produces letter boxes the caret measures.
    const wrapper = mount(TestWord, { props: { word: 'ab', typed: 'ab\t', active: true } })
    const extra = wrapper.findAll('.letter')[2]

    expect(extra.classes()).toContain('letter--tab')
    expect(extra.classes()).toContain('extra')
  })
})
