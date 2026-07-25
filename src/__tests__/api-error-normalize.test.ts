import { describe, it, expect } from 'vitest'
import { FetchError } from 'ofetch'
import { ApiError, apiErrorFromResponse, normalizeError } from '@shared/api/transport'

describe('apiErrorFromResponse — status + body code → normalized error', () => {
  const cases: Array<{
    name: string
    status: number
    body: unknown
    fallback?: string
    code: string
    message?: string
  }> = [
    {
      name: 'server code + message',
      status: 401,
      body: { error: 'unauthorized', message: 'Nope' },
      code: 'unauthorized',
      message: 'Nope'
    },
    {
      name: 'server code, no message',
      status: 409,
      body: { error: 'name_taken' },
      code: 'name_taken',
      message: undefined
    },
    {
      name: 'payload too large',
      status: 413,
      body: { error: 'payload_too_large' },
      code: 'payload_too_large',
      message: undefined
    },
    {
      name: 'structural rule violation',
      status: 422,
      body: { error: 'non_monotonic_seq', message: 'bad seq' },
      code: 'non_monotonic_seq',
      message: 'bad seq'
    },
    {
      name: 'unparseable body falls back to unknown',
      status: 500,
      body: null,
      fallback: 'boom',
      code: 'unknown',
      message: 'boom'
    },
    {
      name: 'body without error field falls back to unknown',
      status: 400,
      body: { message: 'x' },
      code: 'unknown',
      message: undefined
    },
    {
      name: 'status 0 maps to network_error',
      status: 0,
      body: undefined,
      code: 'network_error',
      message: undefined
    }
  ]

  for (const c of cases) {
    it(c.name, () => {
      const err = apiErrorFromResponse(c.status, c.body, c.fallback)
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(c.status)
      expect(err.code).toBe(c.code)
      expect(err.message).toBe(c.message ?? c.code)
    })
  }
})

describe('normalizeError', () => {
  it('maps a FetchError to its response status and body code', () => {
    // ofetch populates these fields on a real failed response.
    const fe = Object.assign(new FetchError('request failed'), {
      response: { status: 403 },
      data: { error: 'forbidden_origin' }
    })

    const err = normalizeError(fe)
    expect(err.status).toBe(403)
    expect(err.code).toBe('forbidden_origin')
  })

  it('maps a bare network Error to network_error at status 0', () => {
    const err = normalizeError(new Error('connection refused'))
    expect(err.status).toBe(0)
    expect(err.code).toBe('network_error')
    expect(err.message).toBe('connection refused')
  })

  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError({ status: 422, code: 'invalid_dimensions' })
    expect(normalizeError(original)).toBe(original)
  })
})
