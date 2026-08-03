/**
 * The one caret rule for every relayed ghost (`caretAnchorOf`): target
 * coordinates, with over-typed characters clamped to the word's length. The
 * race path used to hand-copy the multiplayer rule WITHOUT the clamp, so a
 * record ghost that over-typed a word rendered past its end — these pin the
 * shared function both paths now call.
 */
import { describe, expect, it } from 'vitest'

import type { GameState } from '@typemore/core'
import { caretAnchorOf } from '@entities/match'

const stateWith = (wordIndex: number, input: string[]): GameState =>
  ({ wordIndex, input }) as unknown as GameState

const WORDS = ['alpha', 'be'] as const

describe('caretAnchorOf', () => {
  it('reports the typed length inside the current word', () => {
    expect(caretAnchorOf(WORDS, stateWith(0, ['alp']))).toEqual({ wordIndex: 0, charIndex: 3 })
  })

  it('clamps an over-typed word to its target length — extras occupy no target position', () => {
    expect(caretAnchorOf(WORDS, stateWith(1, ['alpha', 'beeeee']))).toEqual({
      wordIndex: 1,
      charIndex: 2
    })
  })

  it('reads an untouched word as position zero', () => {
    expect(caretAnchorOf(WORDS, stateWith(1, ['alpha']))).toEqual({ wordIndex: 1, charIndex: 0 })
  })

  it('survives a word index past the text (a ghost settling at the end)', () => {
    expect(caretAnchorOf(WORDS, stateWith(2, ['alpha', 'be', 'x']))).toEqual({
      wordIndex: 2,
      charIndex: 0
    })
  })
})
