import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as v from 'valibot'
import type * as OFetch from 'ofetch'
import { request, isApiError } from '@shared/api/transport'

// ofetch's instance is created at module load via `ofetch.create(...)`, so we
// swap it for a controllable mock while keeping the real `FetchError` class.
// `vi.mock` is hoisted above the import above, so the mock is in place first.
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof OFetch>()
  return {
    ...actual,
    ofetch: Object.assign(mockFetch, { create: () => mockFetch })
  }
})

const Schema = v.object({ id: v.string() })

describe('transport request — response boundary parsing', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('throws a normalized ApiError when the body fails the schema', async () => {
    mockFetch.mockResolvedValue({ id: 123 }) // wrong type at the boundary

    const err = await request('/x', Schema).then(
      () => null,
      (e: unknown) => e
    )

    expect(isApiError(err)).toBe(true)
    expect(isApiError(err) && err.code).toBe('invalid_response')
  })

  it('throws when a required field is missing', async () => {
    mockFetch.mockResolvedValue({})

    const err = await request('/x', Schema).then(
      () => null,
      (e: unknown) => e
    )

    expect(isApiError(err) && err.code).toBe('invalid_response')
  })

  it('returns the parsed output for a well-formed body', async () => {
    mockFetch.mockResolvedValue({ id: 'abc' })

    await expect(request('/x', Schema)).resolves.toEqual({ id: 'abc' })
  })
})
