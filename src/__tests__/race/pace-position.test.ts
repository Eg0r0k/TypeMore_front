import { describe, expect, it } from 'vitest'

import { pacePositionAt } from '@/features/test/pace'

/**
 * The pace bot's movement model: a word costs `length + 1` chars (letters plus
 * the committing space), the space slot clamps to "past the last letter", and
 * running out of text is `null` — the bot finished and leaves the track.
 */
describe('pacePositionAt', () => {
  const words = ['ab', 'c', 'defg'] as const
  // Char layout: ab(0,1) space(2) | c(3) space(4) | defg(5..8), total end at 9.

  it('walks the target text letter by letter', () => {
    expect(pacePositionAt(words, 0)).toEqual({ wordIndex: 0, charIndex: 0 })
    expect(pacePositionAt(words, 1)).toEqual({ wordIndex: 0, charIndex: 1 })
    expect(pacePositionAt(words, 3)).toEqual({ wordIndex: 1, charIndex: 0 })
    expect(pacePositionAt(words, 5)).toEqual({ wordIndex: 2, charIndex: 0 })
    expect(pacePositionAt(words, 8)).toEqual({ wordIndex: 2, charIndex: 3 })
  })

  it('clamps the space slot to "past the last letter" of its word', () => {
    // chars = 2 is ab's committing space: still word 0, drawn past 'b'.
    expect(pacePositionAt(words, 2)).toEqual({ wordIndex: 0, charIndex: 2 })
    expect(pacePositionAt(words, 4)).toEqual({ wordIndex: 1, charIndex: 1 })
  })

  it('finishes past the last word’s last letter — and never resurrects', () => {
    expect(pacePositionAt(words, 9)).toBeNull()
    expect(pacePositionAt(words, 100)).toBeNull()
  })

  it('has nothing to pace on an empty text', () => {
    expect(pacePositionAt([], 0)).toBeNull()
  })

  it('stands on the start line for a pre-start clock (negative chars)', () => {
    // The rAF timestamp can predate the performance.now() taken at the starting
    // gun, so the first frame's elapsed — and hence chars — can be negative.
    // charIndex -1 would crash the ghost measurer (letters[-1]).
    expect(pacePositionAt(words, -1)).toEqual({ wordIndex: 0, charIndex: 0 })
  })
})
