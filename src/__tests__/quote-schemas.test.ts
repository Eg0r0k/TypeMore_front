import { describe, it, expect } from 'vitest'
import * as v from 'valibot'

import { QuoteMetaSchema, QuotePageSchema, QuoteSchema } from '@shared/api'

/**
 * QUOTES.md serves two shapes: the index gives metadata and NEVER the text, the
 * single-quote reads give the text. They are two schemas on purpose — one shape
 * with an optional `text` would type-check both endpoints identically and stop
 * guarding the one guarantee the index makes.
 */

const meta = {
  id: '1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e',
  lang: 'german',
  upstreamId: 42,
  source: 'Johann Wolfgang von Goethe',
  length: 187,
  lenGroup: 'medium',
  textHash: '8b1cf30a'
}

describe('quote schemas — the index has no body, the reads do', () => {
  it('parses an index row and drops a text the index must not serve', () => {
    const parsed = v.parse(QuotePageSchema, {
      quotes: [{ ...meta, text: 'leaked' }],
      nextCursor: 'Z2VybWFuOjE6MWY1'
    })
    expect(parsed.quotes[0]).toEqual(meta)
    expect('text' in parsed.quotes[0]).toBe(false)
  })

  it('accepts a last page with no cursor', () => {
    expect(v.parse(QuotePageSchema, { quotes: [] }).nextCursor).toBeUndefined()
  })

  it('rejects an unknown length band rather than dropping the filter', () => {
    expect(v.safeParse(QuoteMetaSchema, { ...meta, lenGroup: 'huge' }).success).toBe(false)
  })

  it('requires text and superseded on a single-quote read', () => {
    expect(v.safeParse(QuoteSchema, meta).success).toBe(false)
    expect(v.safeParse(QuoteSchema, { ...meta, text: 'Es ist nicht genug…' }).success).toBe(false)
    const quote = v.parse(QuoteSchema, { ...meta, text: 'Es ist…', superseded: false })
    expect(quote.text).toBe('Es ist…')
    expect(quote.superseded).toBe(false)
  })
})
