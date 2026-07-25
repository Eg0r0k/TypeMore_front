import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { TestWord } from '@/features/test/word'

describe('TestWord — missed letters & word error state', () => {
  it('marks the untyped tail of a committed word as missed and flags the word errored', () => {
    const wrapper = mount(TestWord, {
      props: { word: 'Привет', typed: 'При', active: false, committed: true }
    })
    const letters = wrapper.findAll('.letter')
    expect(letters).toHaveLength(6)
    expect(letters[0].classes()).toContain('correct')
    expect(letters[2].classes()).toContain('correct')
    // 'вет' (positions 4-6) untyped in a committed word -> missed
    expect(letters[3].classes()).toContain('missed')
    expect(letters[4].classes()).toContain('missed')
    expect(letters[5].classes()).toContain('missed')
    expect(wrapper.classes()).toContain('word--error')
  })

  it('a committed word with a typo is flagged errored', () => {
    const wrapper = mount(TestWord, {
      props: { word: 'cat', typed: 'cxt', active: false, committed: true }
    })
    expect(wrapper.findAll('.letter')[1].classes()).toContain('incorrect')
    expect(wrapper.classes()).toContain('word--error')
  })

  it('the active (not yet committed) word does not mark untyped letters as missed', () => {
    const wrapper = mount(TestWord, {
      props: { word: 'Привет', typed: 'При', active: true, committed: false }
    })
    expect(wrapper.findAll('.letter').some((l) => l.classes().includes('missed'))).toBe(false)
    expect(wrapper.classes()).not.toContain('word--error')
  })

  it('blind hides both missed letters and the error underline', () => {
    const wrapper = mount(TestWord, {
      props: { word: 'Привет', typed: 'При', active: false, committed: true, blind: true }
    })
    expect(wrapper.findAll('.letter').some((l) => l.classes().includes('missed'))).toBe(false)
    expect(wrapper.classes()).not.toContain('word--error')
  })
})
