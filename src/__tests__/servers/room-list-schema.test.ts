/**
 * Per-entry tolerance of the room list schema.
 *
 * The failure unit of `GET /rooms` is one ROOM: a single contract-breaking
 * entry (the motivating case — a stale server shipping a quote room with no
 * dimension at all) is dropped with a logged warning, and every healthy room
 * still reaches the lobby. The envelope stays strict: a response without a
 * `rooms` array is a broken response, not a broken room.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as v from 'valibot'

vi.mock('@/shared/lib/helpers/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import logger from '@/shared/lib/helpers/logger'
import { RoomListSchema } from '@shared/api'

const timeRoom = {
  code: 'ABC123',
  name: 'friday night',
  playerCount: 2,
  maxPlayers: 5,
  inMatch: false,
  settings: { mode: 'time', durationMs: 30_000, lang: 'english' }
}

const quoteRoom = {
  code: 'QUO456',
  name: 'quote night',
  playerCount: 1,
  maxPlayers: 5,
  inMatch: false,
  settings: { mode: 'quote', wordCount: 42, lang: 'english' }
}

/** The stale-server shape: a quote room advertising NO dimension at all. */
const dimensionlessQuoteRoom = {
  ...quoteRoom,
  code: 'BAD789',
  settings: { mode: 'quote', lang: 'english' }
}

beforeEach(() => {
  vi.mocked(logger.warn).mockClear()
})

describe('room list schema — per-entry tolerance', () => {
  it('passes a fully healthy list through untouched', () => {
    const parsed = v.parse(RoomListSchema, { rooms: [timeRoom, quoteRoom] })

    expect(parsed.rooms.map((room) => room.code)).toEqual(['ABC123', 'QUO456'])
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('drops a contract-breaking entry, keeps the healthy rooms, and says so', () => {
    const parsed = v.parse(RoomListSchema, {
      rooms: [timeRoom, dimensionlessQuoteRoom, quoteRoom]
    })

    expect(parsed.rooms.map((room) => room.code)).toEqual(['ABC123', 'QUO456'])
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('renders an empty list rather than an error when every entry is broken', () => {
    const parsed = v.parse(RoomListSchema, { rooms: [dimensionlessQuoteRoom] })

    expect(parsed.rooms).toEqual([])
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('still fails the whole response when the envelope itself is broken', () => {
    expect(() => v.parse(RoomListSchema, { rooms: 'nope' })).toThrow()
    expect(() => v.parse(RoomListSchema, {})).toThrow()
  })

  it('a mutually-contradictory dimension is a broken room, not a rendered lie', () => {
    // Both dimensions at once describes no mode this client knows.
    const contradictory = {
      ...timeRoom,
      code: 'TWO000',
      settings: { mode: 'time', durationMs: 30_000, wordCount: 25, lang: 'english' }
    }

    const parsed = v.parse(RoomListSchema, { rooms: [contradictory, quoteRoom] })

    expect(parsed.rooms.map((room) => room.code)).toEqual(['QUO456'])
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})
