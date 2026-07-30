import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  DEFAULT_MAX_EXTRA_CHARS,
  GameCore,
  commitEvent,
  deleteEvent,
  foldLog,
  insertEvent
} from '@typemore/core'

const config = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 15_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

interface Keys {
  insert: (text: string) => GameEvent
  back: (unit?: 'char' | 'word') => GameEvent
  commit: () => GameEvent
}

/**
 * Monotonic event emitter: rejected events still consume a seq (the store hands one
 * out either way), which is exactly the sequencing a real session produces.
 */
function emitter(): Keys {
  let seq = 0
  let t = 0
  return {
    insert: (text) => insertEvent(++seq, (t += 60), text),
    back: (unit = 'char') => deleteEvent(++seq, (t += 60), unit),
    commit: () => commitEvent(++seq, (t += 60))
  }
}

const coreOf = (words: string[], over: Partial<CoreConfig> = {}): GameCore =>
  new GameCore({ config: config(over), words })

/** Types every character of `text` as separate inserts. */
function typeText(core: GameCore, keys: Keys, text: string): void {
  for (const char of text) core.dispatch(keys.insert(char))
}

describe('freedom mode', () => {
  it('locks a backspace into a correct previous word by default', () => {
    const core = coreOf(['hello', 'world'])
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())

    const result = core.dispatch(keys.back())

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().kind).toBe('BackspaceLocked')
    expect(core.state.wordIndex).toBe(1)
  })

  it('lets the caret back into a correct previous word when on', () => {
    const core = coreOf(['hello', 'world'], { freedomMode: true })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())

    const result = core.dispatch(keys.back())

    expect(result.isOk()).toBe(true)
    expect(core.state.wordIndex).toBe(0)
    // Buffers survive: the word is re-activated, not re-typed.
    expect(core.state.input[0]).toBe('hello')
  })

  it('keeps editing the restored word (the caret really moved back)', () => {
    const core = coreOf(['hello', 'world'], { freedomMode: true })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())
    core.dispatch(keys.back())
    core.dispatch(keys.back())

    expect(core.state.input[0]).toBe('hell')
    expect(core.state.wordIndex).toBe(0)
    core.dispatch(keys.insert('o'))
    core.dispatch(keys.commit())
    expect(core.state.wordIndex).toBe(1)
  })
})

describe("stopOnError: 'letter'", () => {
  it("records a wrong grapheme when 'off'", () => {
    const core = coreOf(['hello', 'world'])
    const keys = emitter()
    typeText(core, keys, 'hex')

    expect(core.state.input[0]).toBe('hex')
  })

  it('rejects the wrong grapheme and leaves the state untouched', () => {
    const core = coreOf(['hello', 'world'], { stopOnError: 'letter' })
    const keys = emitter()
    typeText(core, keys, 'he')
    const before = core.state
    const logged = core.events.length

    const result = core.dispatch(keys.insert('x'))

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.kind).toBe('StoppedOnError')
    // The store answers with the offending seq; nothing advanced behind it.
    expect(error.seq).toBe(3)
    expect(core.state).toEqual(before)
    expect(core.events.length).toBe(logged)

    core.dispatch(keys.insert('l'))
    expect(core.state.input[0]).toBe('hel')
  })

  it('does not start the run on a rejected first keystroke', () => {
    const core = coreOf(['hello'], { stopOnError: 'letter' })
    const keys = emitter()

    expect(core.dispatch(keys.insert('x')).isErr()).toBe(true)
    expect(core.state.phase).toBe('idle')
    expect(core.state.startedAt).toBeNull()
    expect(core.state.lastSeq).toBeNull()
  })

  it('lets master difficulty win: the run fails instead of refusing the key', () => {
    const core = coreOf(['hello'], { stopOnError: 'letter', difficulty: 'master' })
    const keys = emitter()
    typeText(core, keys, 'he')

    const result = core.dispatch(keys.insert('x'))

    expect(result.isOk()).toBe(true)
    expect(core.state.phase).toBe('finished')
    expect(core.state.failReason).toBe('master')
  })
})

describe("stopOnError: 'word'", () => {
  it('refuses the commit until the word matches', () => {
    const core = coreOf(['hello', 'world'], { stopOnError: 'word' })
    const keys = emitter()
    typeText(core, keys, 'hell')

    const refused = core.dispatch(keys.commit())
    expect(refused.isErr()).toBe(true)
    expect(refused._unsafeUnwrapErr().kind).toBe('StoppedOnError')
    expect(core.state.wordIndex).toBe(0)

    core.dispatch(keys.insert('o'))
    expect(core.dispatch(keys.commit()).isOk()).toBe(true)
    expect(core.state.wordIndex).toBe(1)
  })

  it('refuses a wrong-but-complete word too', () => {
    const core = coreOf(['hello', 'world'], { stopOnError: 'word' })
    const keys = emitter()
    typeText(core, keys, 'hallo')

    expect(core.dispatch(keys.commit())._unsafeUnwrapErr().kind).toBe('StoppedOnError')
    expect(core.state.wordIndex).toBe(0)
  })

  it('blocks skipping a word with an empty buffer', () => {
    const core = coreOf(['hello', 'world'], { stopOnError: 'word' })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())

    const skipped = core.dispatch(keys.commit())

    expect(skipped.isErr()).toBe(true)
    expect(skipped._unsafeUnwrapErr().kind).toBe('StoppedOnError')
    expect(core.state.wordIndex).toBe(1)
  })

  it('lets expert difficulty win: the errored commit fails the run', () => {
    const core = coreOf(['hello', 'world'], { stopOnError: 'word', difficulty: 'expert' })
    const keys = emitter()
    typeText(core, keys, 'hallo')

    const result = core.dispatch(keys.commit())

    expect(result.isOk()).toBe(true)
    expect(core.state.phase).toBe('finished')
    expect(core.state.failReason).toBe('expert')
  })

  it('still commits a correct word normally', () => {
    const core = coreOf(['hello', 'world'], { stopOnError: 'word' })
    const keys = emitter()
    typeText(core, keys, 'hello')

    expect(core.dispatch(keys.commit()).isOk()).toBe(true)
    expect(core.state.wordIndex).toBe(1)
  })
})

describe('quick end', () => {
  it('needs the closing commit by default', () => {
    const core = coreOf(['hello', 'world'])
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())
    typeText(core, keys, 'world')

    expect(core.state.phase).toBe('running')
    core.dispatch(keys.commit())
    expect(core.state.phase).toBe('finished')
  })

  it("finishes on the last word's final grapheme", () => {
    const core = coreOf(['hello', 'world'], { quickEnd: true })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())
    typeText(core, keys, 'worl')
    expect(core.state.phase).toBe('running')

    const last = keys.insert('d')
    core.dispatch(last)

    expect(core.state.phase).toBe('finished')
    expect(core.state.wordIndex).toBe(2)
    expect(core.state.finishedAt).toBe(last.t)
  })

  it('finishes even when the last word is wrong', () => {
    const core = coreOf(['hello', 'world'], { quickEnd: true })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())
    typeText(core, keys, 'worlx')

    expect(core.state.phase).toBe('finished')
    expect(core.state.failReason).toBeNull()
    expect(core.state.input[1]).toBe('worlx')
  })

  it('does not fire before the last word', () => {
    const core = coreOf(['hello', 'world'], { quickEnd: true })
    const keys = emitter()
    typeText(core, keys, 'hello')

    expect(core.state.phase).toBe('running')
    expect(core.state.wordIndex).toBe(0)
  })

  it('leaves timed mode alone', () => {
    const core = coreOf(['hello', 'world'], { quickEnd: true, mode: 'time' })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())
    typeText(core, keys, 'world')

    expect(core.state.phase).toBe('running')
  })
})

/**
 * A nospace run has no separator to press: the word advances on the insert that
 * completes it. A commit event therefore has no meaning — and `validateLog`
 * rejects an entire nospace log that contains one, so an accepted no-op would
 * turn a habitual space press into an invalidated honest run. The reducer
 * refuses it instead: rejected events are never logged and hand their seq back.
 */
describe('nospace: commits are refused, not logged', () => {
  it('rejects the commit and leaves the state untouched (space is inert)', () => {
    const core = coreOf(['hello', 'world'], { nospace: true })
    const keys = emitter()
    typeText(core, keys, 'hel')
    const before = core.state

    const result = core.dispatch(keys.commit())

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().kind).toBe('NospaceCommit')
    expect(core.state).toEqual(before)
  })

  it('refuses a commit before the first keystroke too (leading space)', () => {
    const core = coreOf(['hello'], { nospace: true })
    const keys = emitter()

    expect(core.dispatch(keys.commit()).isErr()).toBe(true)
    expect(core.state.phase).toBe('idle')
    expect(core.events).toHaveLength(0)
  })

  it('keeps the log commit-free while the run plays normally around the space presses', () => {
    const core = coreOf(['hello', 'world'], { nospace: true })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit()) // habitual space after the auto-committed word
    typeText(core, keys, 'world')
    core.dispatch(keys.commit())

    expect(core.events.some((event) => event.kind === 'commit')).toBe(false)
    expect(core.state.input).toEqual(['hello', 'world'])
    expect(core.state.phase).toBe('finished')
  })

  it('replays clean: the rejected commits never entered the log', () => {
    const core = coreOf(['hello', 'world'], { nospace: true })
    const keys = emitter()
    typeText(core, keys, 'hello')
    core.dispatch(keys.commit())
    typeText(core, keys, 'world')

    const ctx: CoreContext = { config: config({ nospace: true }), words: ['hello', 'world'] }
    const folded = foldLog(ctx, core.events)

    expect(folded.isOk()).toBe(true)
    expect(folded._unsafeUnwrap()).toEqual(core.state)
  })
})

describe('replay compatibility', () => {
  const words = ['hello', 'world', 'foo']
  // A log that touches every new rule's trigger: a wrong char, a backspace, an empty
  // commit and a commit of an errored word.
  const log: GameEvent[] = [
    insertEvent(1, 0, 'h'),
    insertEvent(2, 60, 'e'),
    insertEvent(3, 120, 'x'),
    deleteEvent(4, 180, 'char'),
    insertEvent(5, 240, 'l'),
    insertEvent(6, 300, 'l'),
    insertEvent(7, 360, 'o'),
    commitEvent(8, 420),
    commitEvent(9, 480), // empty commit: no advance
    insertEvent(10, 540, 'w'),
    insertEvent(11, 600, 'o'),
    commitEvent(12, 660), // errored (short) commit
    insertEvent(13, 720, 'f'),
    insertEvent(14, 780, 'o'),
    insertEvent(15, 840, 'o')
  ]

  it('a snapshot without the new fields replays exactly like the explicit legacy values', () => {
    const legacy: CoreContext = { config: config(), words }
    const explicit: CoreContext = {
      config: config({ freedomMode: false, stopOnError: 'off', quickEnd: false }),
      words
    }

    const a = foldLog(legacy, log)._unsafeUnwrap()
    const b = foldLog(explicit, log)._unsafeUnwrap()

    expect(a).toEqual(b)
    // Old behaviour, unchanged: the wrong char stuck, the empty commit was a no-op,
    // the errored word committed, and the run still waits for its closing commit.
    expect(a.phase).toBe('running')
    expect(a.wordIndex).toBe(2)
    expect(a.input).toEqual(['hello', 'wo', 'foo'])
  })

  it('a legacy snapshot still locks backspace and still needs the final commit', () => {
    const ctx: CoreContext = { config: config(), words: ['hello', 'world'] }
    const locked = foldLog(ctx, [
      insertEvent(1, 0, 'h'),
      insertEvent(2, 60, 'e'),
      insertEvent(3, 120, 'l'),
      insertEvent(4, 180, 'l'),
      insertEvent(5, 240, 'o'),
      commitEvent(6, 300),
      deleteEvent(7, 360, 'char')
    ])

    expect(locked.isErr()).toBe(true)
    expect(locked._unsafeUnwrapErr().error.kind).toBe('BackspaceLocked')
  })

  it('serializes without the new keys when they are unset', () => {
    const snapshot = config()

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(Object.keys(JSON.parse(JSON.stringify(snapshot)))).not.toContain('quickEnd')
  })
})
