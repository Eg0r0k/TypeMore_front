import { randomFillSync } from 'node:crypto'

import { describe, it, expect, afterEach } from 'vitest'

import { uuid } from '@/shared/lib/helpers/misc'

/** RFC 4122 v4: version nibble `4`, variant nibble one of 8/9/a/b. */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const originalRandomUUID = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
const originalGetRandomValues = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues')

/** `randomUUID` can be a read-only accessor — redefine it, never assign. */
const define = (key: 'randomUUID' | 'getRandomValues', value: unknown): void => {
  Object.defineProperty(crypto, key, { value, configurable: true, writable: true })
}

const restore = (key: 'randomUUID' | 'getRandomValues', from?: PropertyDescriptor): void => {
  if (from) Object.defineProperty(crypto, key, from)
  else define(key, undefined)
}

afterEach(() => {
  restore('randomUUID', originalRandomUUID)
  restore('getRandomValues', originalGetRandomValues)
})

describe('uuid', () => {
  it('delegates to crypto.randomUUID when the secure-context API exists', () => {
    define('randomUUID', () => '11111111-2222-4333-8444-555555555555')
    expect(uuid()).toBe('11111111-2222-4333-8444-555555555555')
  })

  it('falls back to getRandomValues when randomUUID is missing (plain-http dev server)', () => {
    define('randomUUID', undefined)
    // This happy-dom's `crypto` ships no getRandomValues of its own, so back
    // the fallback with Node's real entropy — the path under test is the
    // helper's branch choice, not the host's crypto surface. randomFillSync,
    // not webcrypto.getRandomValues: node's webcrypto IS this same global
    // here, so delegating to it would recurse into this very stub.
    define('getRandomValues', (buffer: Uint8Array) => randomFillSync(buffer))
    expect(uuid()).toMatch(V4)
  })

  it('forces the version and variant bits itself on the fallback path', () => {
    define('randomUUID', undefined)
    // All-zero entropy: the only non-zero nibbles left must be the ones the
    // fallback stamps in — version `4` and variant `8`.
    define('getRandomValues', (buffer: Uint8Array) => buffer.fill(0))
    expect(uuid()).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('does not repeat across calls on the fallback path', () => {
    define('randomUUID', undefined)
    define('getRandomValues', (buffer: Uint8Array) => randomFillSync(buffer))
    const seen = new Set(Array.from({ length: 100 }, () => uuid()))
    expect(seen.size).toBe(100)
  })
})
