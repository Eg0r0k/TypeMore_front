// The transport boundary: everything below the parsers trusts branded types,
// so these guards are the only thing standing between relayed JSON and a core.
import { describe, expect, it } from 'vitest'

import {
  type GameEvent,
  EVENT_LOG_VERSION,
  commitEvent,
  deleteEvent,
  insertEvent,
  parseEventBatch,
  parseGameEvent,
  replaceEvent
} from '@shared/core'

const valid = { kind: 'insert', seq: 1, t: 0, text: 'a' }

describe('parseGameEvent', () => {
  const malformed: Array<[string, unknown, string]> = [
    ['null', null, 'bad-shape'],
    ['a number', 42, 'bad-shape'],
    ['a string', 'insert', 'bad-shape'],
    ['an array', [], 'bad-shape'],
    ['missing seq', { kind: 'insert', t: 0, text: 'a' }, 'bad-seq'],
    ['seq 0', { ...valid, seq: 0 }, 'bad-seq'],
    ['negative seq', { ...valid, seq: -3 }, 'bad-seq'],
    ['fractional seq', { ...valid, seq: 1.5 }, 'bad-seq'],
    ['string seq', { ...valid, seq: '1' }, 'bad-seq'],
    ['missing t', { kind: 'insert', seq: 1, text: 'a' }, 'bad-t'],
    ['negative t', { ...valid, t: -1 }, 'bad-t'],
    ['NaN t', { ...valid, t: Number.NaN }, 'bad-t'],
    ['Infinity t', { ...valid, t: Number.POSITIVE_INFINITY }, 'bad-t'],
    ['string t', { ...valid, t: '0' }, 'bad-t'],
    ['missing kind', { seq: 1, t: 0 }, 'bad-kind'],
    ['unknown kind', { seq: 1, t: 0, kind: 'teleport' }, 'bad-kind'],
    ['numeric kind', { seq: 1, t: 0, kind: 7 }, 'bad-kind'],
    ['insert without text', { kind: 'insert', seq: 1, t: 0 }, 'bad-shape'],
    ['insert with numeric text', { kind: 'insert', seq: 1, t: 0, text: 42 }, 'bad-shape'],
    ['insert with empty text', { kind: 'insert', seq: 1, t: 0, text: '' }, 'bad-shape'],
    ['delete without unit', { kind: 'delete', seq: 1, t: 0 }, 'bad-shape'],
    ['delete with bad unit', { kind: 'delete', seq: 1, t: 0, unit: 'line' }, 'bad-shape'],
    [
      'replace with negative from',
      { kind: 'replace', seq: 1, t: 0, from: -1, to: 0, text: '', source: 'ime' },
      'bad-shape'
    ],
    [
      'replace with inverted range',
      { kind: 'replace', seq: 1, t: 0, from: 3, to: 1, text: '', source: 'ime' },
      'bad-shape'
    ],
    [
      'replace with fractional from',
      { kind: 'replace', seq: 1, t: 0, from: 0.5, to: 1, text: 'x', source: 'paste' },
      'bad-shape'
    ],
    [
      'replace with numeric text',
      { kind: 'replace', seq: 1, t: 0, from: 0, to: 1, text: 9, source: 'paste' },
      'bad-shape'
    ],
    [
      'replace with unknown source',
      { kind: 'replace', seq: 1, t: 0, from: 0, to: 1, text: 'x', source: 'drop' },
      'bad-shape'
    ]
  ]

  it.each(malformed)('rejects %s', (_name, payload, code) => {
    expect(parseGameEvent(payload)._unsafeUnwrapErr().code).toBe(code)
  })

  it('reports the first failing check when several are wrong (shape → seq → t → kind)', () => {
    expect(parseGameEvent({ kind: 'teleport', seq: 0, t: -1 })._unsafeUnwrapErr().code).toBe(
      'bad-seq'
    )
    expect(parseGameEvent({ kind: 'teleport', seq: 1, t: -1 })._unsafeUnwrapErr().code).toBe(
      'bad-t'
    )
  })

  it('tolerates unknown extra fields and drops them from the canonical output', () => {
    const parsed = parseGameEvent({ ...valid, playerId: 'p2', padding: [1, 2] })._unsafeUnwrap()
    expect(parsed).toEqual(insertEvent(1, 0, 'a'))
    expect('playerId' in parsed).toBe(false)
  })

  const roundTrips: Array<[string, GameEvent]> = [
    ['insert', insertEvent(3, 120, 'a')],
    ['delete char', deleteEvent(4, 180, 'char')],
    ['delete word', deleteEvent(5, 200, 'word')],
    ['commit', commitEvent(6, 240)],
    ['replace (ime)', replaceEvent(7, 300, 0, 2, 'ab', 'ime')],
    ['replace (paste)', replaceEvent(8, 360, 1, 1, 'xyz', 'paste')]
  ]

  it.each(roundTrips)('%s survives JSON stringify → parse → parseGameEvent', (_name, event) => {
    const parsed = parseGameEvent(JSON.parse(JSON.stringify(event)))._unsafeUnwrap()
    expect(parsed).toEqual(event)
  })
})

describe('parseEventBatch', () => {
  const events = [
    insertEvent(1, 0, 'a'),
    deleteEvent(2, 40, 'char'),
    insertEvent(3, 90, 'b'),
    commitEvent(4, 130)
  ]

  it('accepts a JSON round-tripped log and returns branded events', () => {
    const wire: unknown = JSON.parse(JSON.stringify({ version: EVENT_LOG_VERSION, events }))
    const log = parseEventBatch(wire)._unsafeUnwrap()
    expect(log.version).toBe(EVENT_LOG_VERSION)
    expect(log.events).toEqual(events)
  })

  it('rejects a non-object batch', () => {
    expect(parseEventBatch(events)._unsafeUnwrapErr().code).toBe('bad-shape')
    expect(parseEventBatch(null)._unsafeUnwrapErr().code).toBe('bad-shape')
  })

  it('rejects a missing or unsupported version', () => {
    expect(parseEventBatch({ events })._unsafeUnwrapErr().code).toBe('bad-version')
    // 2 became legal with the telemetry log (the ONLY version bump so far);
    // the next unknown version is the new "unsupported" specimen.
    expect(parseEventBatch({ version: 3, events })._unsafeUnwrapErr().code).toBe('bad-version')
    expect(parseEventBatch({ version: '1', events })._unsafeUnwrapErr().code).toBe('bad-version')
  })

  it('rejects non-array events', () => {
    expect(
      parseEventBatch({ version: EVENT_LOG_VERSION, events: {} })._unsafeUnwrapErr().code
    ).toBe('bad-shape')
  })

  it('reports the array index of the first malformed event', () => {
    const error = parseEventBatch({
      version: EVENT_LOG_VERSION,
      events: [events[0], { kind: 'teleport', seq: 2, t: 40 }]
    })._unsafeUnwrapErr()
    expect(error.code).toBe('bad-kind')
    expect(error.index).toBe(1)
  })
})
