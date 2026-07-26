/**
 * Code/quote layout: a newline is a HARD line break, a tab is indentation.
 *
 * Both fall out of ONE rule in the generator — a line break ends its token
 * (`words.ts`, ported from monkeytype's `getQuoteWordList`). With that in place
 * a target never contains a newline anywhere but its end, so the field's
 * existing "breaker after the word that owns a newline" is sufficient, and a tab
 * only ever opens a token, which is what makes it the line's indent.
 *
 * These specs drive the REAL generator rather than restating the split, so they
 * fail if that rule is ever dropped.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { TestWord } from '@/features/test/word'
import { wordBreaksLine } from '@entities/game'
import {
  dictVersion,
  generateWords,
  makeSeedContext,
  type Dictionary,
  type GenerationConfig
} from '@shared/core'

/** The owner's screenshot text. */
const CSS_TEXT = 'p.center {\n\ttext-align: center;\n\tcolor: red;\n}\n\np.large {\n\tfont-size: 300%\n;}'

/** A quote run's targets, straight out of the core. */
function targetsOf(text: string): readonly string[] {
  const dict: Dictionary = { name: 'code_css', bcp47: 'en', words: ['unused'] }
  const generation: GenerationConfig = {
    mode: 'quote',
    length: 0,
    punctuation: false,
    numbers: false,
    randomCase: false,
    reverse: false,
    textSource: { kind: 'quote', quoteId: 'q1', quoteHash: dictVersion([text]), text }
  }
  return generateWords(dict, makeSeedContext(dict, 1, generation))._unsafeUnwrap().words
}

/** Group targets into visual lines the way the field's breakers do. */
function linesOf(targets: readonly string[]): string[] {
  const lines: string[] = []
  let current: string[] = []
  for (const target of targets) {
    current.push(target.replace(/\t/g, '→').replace(/\n/g, '↵'))
    if (wordBreaksLine(target)) {
      lines.push(current.join(' '))
      current = []
    }
  }
  if (current.length > 0) lines.push(current.join(' '))
  return lines
}

describe('the generator ends a token at every newline', () => {
  const targets = targetsOf(CSS_TEXT)

  it('produces one token per word and per line ending', () => {
    expect(targets).toEqual([
      'p.center',
      '{\n',
      '\ttext-align:',
      'center;\n',
      '\tcolor:',
      'red;\n',
      '}\n',
      '\n',
      'p.large',
      '{\n',
      '\tfont-size:',
      '300%\n',
      ';}'
    ])
  })

  it('leaves no newline anywhere but the end of its token', () => {
    // The property the whole layout rests on: a target is one box, so a newline
    // in the middle of one could never be a line break.
    for (const target of targets) {
      if (target.includes('\n')) expect(target.endsWith('\n')).toBe(true)
      expect(target.indexOf('\n')).toBe(target.includes('\n') ? target.length - 1 : -1)
    }
  })

  it('opens a line with its indentation, never trailing it onto the line before', () => {
    expect(targets.filter((t) => t.startsWith('\t'))).toEqual([
      '\ttext-align:',
      '\tcolor:',
      '\tfont-size:'
    ])
  })

  it('lays the text out as its source, blank line included', () => {
    expect(linesOf(targets)).toEqual([
      'p.center {↵',
      '→text-align: center;↵',
      '→color: red;↵',
      '}↵',
      '↵',
      'p.large {↵',
      '→font-size: 300%↵',
      ';}'
    ])
  })

  it('gives a doubled newline a token of its own, which is the blank line', () => {
    expect(targets.filter((t) => t === '\n')).toHaveLength(1)
    expect(wordBreaksLine('\n')).toBe(true)
  })

  it('leaves prose untouched — no newline, no extra token', () => {
    expect(targetsOf('the quick brown fox')).toEqual(['the', 'quick', 'brown', 'fox'])
  })
})

describe('the field draws the layout characters', () => {
  it('breaks the line after a target that owns a newline, and not otherwise', () => {
    expect(wordBreaksLine('{\n')).toBe(true)
    expect(wordBreaksLine('\n')).toBe(true)
    expect(wordBreaksLine('p.center')).toBe(false)
    expect(wordBreaksLine('\ttext-align:')).toBe(false)
  })

  it('renders the blank-line target as a single newline glyph', () => {
    const wrapper = mount(TestWord, { props: { word: '\n', typed: '', active: false } })
    const letters = wrapper.findAll('.letter')
    expect(letters).toHaveLength(1)
    expect(letters[0].text()).toBe('↵')
    expect(letters[0].classes()).toContain('letter--ws')
  })

  it('keeps an ordinary letter free of the whitespace marker', () => {
    const wrapper = mount(TestWord, { props: { word: 'p.center', typed: '', active: false } })
    expect(wrapper.findAll('.letter')[0].classes()).not.toContain('letter--ws')
  })
})
