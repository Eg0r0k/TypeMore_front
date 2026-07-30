import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  DEFAULT_MAX_EXTRA_CHARS,
  commitEvent,
  deleteEvent,
  foldLog,
  insertEvent,
  reduce
} from '@typemore/core'

const core = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 15_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  ...over
})

const ctxOf = (words: string[], over: Partial<CoreConfig> = {}): CoreContext => ({
  config: core(over),
  words
})

describe('difficulty: expert', () => {
  it('fails the test when a committed word has an error', () => {
    const ctx = ctxOf(['cat', 'dog'], { difficulty: 'expert' })
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'c'),
      insertEvent(2, 10, 'x'), // typo
      insertEvent(3, 20, 't'),
      commitEvent(4, 30)
    ])._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.failReason).toBe('expert')
    expect(state.wordIndex).toBe(0) // did not advance past the failed word
  })

  it('commits a correct word normally (no fail)', () => {
    const ctx = ctxOf(['cat', 'dog'], { difficulty: 'expert' })
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'c'),
      insertEvent(2, 10, 'a'),
      insertEvent(3, 20, 't'),
      commitEvent(4, 30)
    ])._unsafeUnwrap()
    expect(state.phase).toBe('running')
    expect(state.wordIndex).toBe(1)
    expect(state.failReason).toBeNull()
  })
})

describe('difficulty: master', () => {
  it('fails on the first wrong keystroke', () => {
    const ctx = ctxOf(['cat'], { difficulty: 'master' })
    const state = foldLog(ctx, [insertEvent(1, 0, 'c'), insertEvent(2, 10, 'x')])._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.failReason).toBe('master')
  })

  it('does not fail while typing correctly', () => {
    const ctx = ctxOf(['cat'], { difficulty: 'master' })
    const state = foldLog(ctx, [insertEvent(1, 0, 'c'), insertEvent(2, 10, 'a')])._unsafeUnwrap()
    expect(state.phase).toBe('running')
    expect(state.failReason).toBeNull()
  })
})

describe('nospace mode', () => {
  it('auto-commits on word completion with no commit events in the log', () => {
    const ctx = ctxOf(['ab', 'cd'], { nospace: true })
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'b'),
      insertEvent(3, 20, 'c')
    ])._unsafeUnwrap()
    expect(state.wordIndex).toBe(1)
    expect(state.input[0]).toBe('ab')
    expect(state.input[1]).toBe('c')
  })

  it('a typo in the last letter still advances (word committed with an error)', () => {
    const ctx = ctxOf(['ab', 'cd'], { nospace: true })
    const state = foldLog(ctx, [insertEvent(1, 0, 'a'), insertEvent(2, 10, 'x')])._unsafeUnwrap()
    expect(state.wordIndex).toBe(1)
    expect(state.input[0]).toBe('ax')
    expect(state.input[0]).not.toBe(ctx.words[0]) // error preserved for scoring
  })

  it('nospace + expert: a typo in the last letter fails the test', () => {
    const ctx = ctxOf(['ab', 'cd'], { nospace: true, difficulty: 'expert' })
    const state = foldLog(ctx, [insertEvent(1, 0, 'a'), insertEvent(2, 10, 'x')])._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.failReason).toBe('expert')
  })

  it('finishes on completing the last word', () => {
    const ctx = ctxOf(['ab'], { nospace: true })
    const state = foldLog(ctx, [insertEvent(1, 0, 'a'), insertEvent(2, 10, 'b')])._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.failReason).toBeNull()
  })

  it('replays bit-identically', () => {
    const ctx = ctxOf(['ab', 'cd', 'ef'], { nospace: true })
    const log = [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'b'),
      insertEvent(3, 20, 'c'),
      insertEvent(4, 30, 'd'),
      insertEvent(5, 40, 'e'),
      insertEvent(6, 50, 'f')
    ]
    expect(foldLog(ctx, log)._unsafeUnwrap()).toEqual(foldLog(ctx, log)._unsafeUnwrap())
  })
})

describe('difficulty: expert with an underfilled word', () => {
  it('committing a too-short word fails (missed counts as an error)', () => {
    const ctx = ctxOf(['Привет', 'мир'], { difficulty: 'expert' })
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'П'),
      insertEvent(2, 10, 'р'),
      insertEvent(3, 20, 'и'),
      commitEvent(4, 30) // 'При' !== 'Привет' -> missed letters -> expert fail
    ])._unsafeUnwrap()
    expect(state.phase).toBe('finished')
    expect(state.failReason).toBe('expert')
  })
})

describe('nospace + backspace lock interaction', () => {
  it('auto-commit of a correct word locks it against backspace (rejected)', () => {
    const ctx = ctxOf(['ab', 'cd'], { nospace: true })
    const committed = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'b') // completes 'ab' -> auto-commit (correct), now at word 1
    ])._unsafeUnwrap()
    expect(committed.wordIndex).toBe(1)
    const blocked = reduce(ctx, committed, deleteEvent(3, 20, 'char'))
    expect(blocked.isErr()).toBe(true)
    expect(blocked._unsafeUnwrapErr().kind).toBe('BackspaceLocked')
  })

  it('auto-commit of a mistyped word allows backspace back into it', () => {
    const ctx = ctxOf(['ab', 'cd'], { nospace: true })
    const state = foldLog(ctx, [
      insertEvent(1, 0, 'a'),
      insertEvent(2, 10, 'x'), // completes 'ax' (errored) -> auto-commit
      deleteEvent(3, 20, 'char') // word 1 empty, prev errored -> step back
    ])._unsafeUnwrap()
    expect(state.wordIndex).toBe(0)
    expect(state.input[0]).toBe('ax')
  })
})
