import { describe, expect, it } from 'vitest'
import * as v from 'valibot'

import {
  BoardEntrySchema,
  BucketCatalogueSchema,
  BucketInfoSchema,
  isQuoteBucket,
  type BucketInfo
} from '@shared/api'

/**
 * The catalogue serves TWO bucket shapes and a client that knows only one of
 * them cannot read the page at all: `v.array` fails whole, so a single
 * unparseable row takes every board down with it. That is exactly what happened
 * when per-quote boards shipped server-side — `/boards` sat on "loading the
 * board…" forever because one `quote:` row failed a schema that required
 * `mode`, `lang` and `textSource`.
 *
 * These payloads are copied from a live `GET /api/v1/leaderboards`, so the specs
 * fail if either shape drifts.
 */

const LANGUAGE_BUCKET = {
  bucket: 'time:15000:css_code:seeded',
  mode: 'time',
  durationMs: 15000,
  lang: 'css_code',
  textSource: 'seeded',
  entries: 1
}

const QUOTE_BUCKET = {
  bucket: 'quote:0a6c0103-89c8-43be-bd66-1371216d4a53',
  quoteId: '0a6c0103-89c8-43be-bd66-1371216d4a53',
  entries: 1
}

describe('the catalogue parses both kinds of board', () => {
  it('accepts a language bucket', () => {
    const parsed = v.parse(BucketInfoSchema, LANGUAGE_BUCKET)
    expect(isQuoteBucket(parsed)).toBe(false)
    expect(parsed).toEqual(LANGUAGE_BUCKET)
  })

  it('accepts a quote bucket, which carries no mode, language or dimension', () => {
    // LEADERBOARDS.md: those fields are ABSENT on a quote board rather than
    // empty, so a client cannot read a mode off a board that has none.
    const parsed = v.parse(BucketInfoSchema, QUOTE_BUCKET)
    expect(isQuoteBucket(parsed)).toBe(true)
    expect(parsed).toEqual(QUOTE_BUCKET)
  })

  it('parses a mixed catalogue — one bad row must not take the page down', () => {
    const parsed = v.parse(BucketCatalogueSchema, {
      buckets: [QUOTE_BUCKET, LANGUAGE_BUCKET]
    })
    expect(parsed.buckets).toHaveLength(2)
    expect(parsed.buckets.filter(isQuoteBucket)).toHaveLength(1)
  })

  it('narrows cleanly, so a caller cannot read a language field off a quote board', () => {
    const buckets: BucketInfo[] = [
      v.parse(BucketInfoSchema, QUOTE_BUCKET),
      v.parse(BucketInfoSchema, LANGUAGE_BUCKET)
    ]
    const named = buckets.map((b) => (isQuoteBucket(b) ? `quote ${b.quoteId.slice(0, 8)}` : b.lang))
    expect(named).toEqual(['quote 0a6c0103', 'css_code'])
  })

  it('still rejects a row that is neither shape', () => {
    // A language bucket missing its mode is a server bug, not a third shape.
    expect(v.safeParse(BucketInfoSchema, { bucket: 'x', lang: 'en', entries: 1 }).success).toBe(
      false
    )
    expect(v.safeParse(BucketInfoSchema, { bucket: 'x', entries: 1 }).success).toBe(false)
  })
})

describe('a board row keeps the quote attribution', () => {
  const ENTRY = {
    rank: 1,
    userId: 'u1',
    displayName: 's3smoke',
    score: 1681,
    wpm: 83,
    raw: 84,
    acc: 1,
    grade: 'SS',
    mods: {
      punctuation: false,
      numbers: false,
      randomCase: false,
      reverse: false,
      nospace: false,
      difficulty: 'normal',
      minWpm: 0,
      blind: false,
      fading: false,
      flashlight: false
    },
    runId: 'r1',
    achievedAt: '2026-07-26T13:43:14.772724Z'
  }

  it('reads `source` on a quote board row instead of dropping it', () => {
    const parsed = v.parse(BoardEntrySchema, {
      ...ENTRY,
      source: 'Patrick Jane, The Mentalist'
    })
    expect(parsed.source).toBe('Patrick Jane, The Mentalist')
  })

  it('leaves it undefined on a language board row, where the server omits it', () => {
    expect(v.parse(BoardEntrySchema, ENTRY).source).toBeUndefined()
  })
})
