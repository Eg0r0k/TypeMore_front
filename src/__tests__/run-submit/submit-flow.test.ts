import { describe, it, expect, vi } from 'vitest'

import type { RunSubmitInput } from '@shared/api'
import {
  runSubmissionFlow,
  type RunSubmissionDeps,
  type SubmissionGate,
  type SubmitState
} from '@/features/run-submit/model/submit-flow'

// Minimal ApiError-alike; the flow only asks its injected predicates, so a plain
// status carrier is enough to drive the network/401 branches.
class FakeApiError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`)
  }
}
const networkError = new FakeApiError(0)
const authError = new FakeApiError(401)
const validationError = new FakeApiError(422)

const dummyPayload = { mode: 'time' } as unknown as RunSubmitInput

function makeDeps(overrides: Partial<RunSubmissionDeps> = {}): {
  deps: RunSubmissionDeps
  states: SubmitState[]
} {
  const states: SubmitState[] = []
  const deps: RunSubmissionDeps = {
    submit: vi.fn().mockResolvedValue({ id: 'r1', status: 'pending' }),
    buildPayload: vi.fn(() => dummyPayload),
    isNetworkError: (e) => e instanceof FakeApiError && e.status === 0,
    isAuthError: (e) => e instanceof FakeApiError && e.status === 401,
    onState: (s) => states.push(s),
    ...overrides
  }
  return { deps, states }
}

describe('runSubmissionFlow — fires only when authed ∧ finished ∧ eligible', () => {
  const table: Array<{
    name: string
    gate: SubmissionGate
    submitted: boolean
    final: SubmitState
  }> = [
    {
      name: 'guest (finished + eligible, not authed)',
      gate: { finished: true, authed: false, eligible: true },
      submitted: false,
      final: 'guest'
    },
    {
      name: 'failed/aborted run (not finished)',
      gate: { finished: false, authed: true, eligible: true },
      submitted: false,
      final: 'idle'
    },
    {
      name: 'free/ineligible mode',
      gate: { finished: true, authed: true, eligible: false },
      submitted: false,
      final: 'ineligible'
    },
    {
      name: 'authed + finished + eligible',
      gate: { finished: true, authed: true, eligible: true },
      submitted: true,
      final: 'saved'
    }
  ]

  for (const c of table) {
    it(c.name, async () => {
      const { deps } = makeDeps()
      const result = await runSubmissionFlow(c.gate, deps)
      expect(result).toBe(c.final)
      expect(deps.submit).toHaveBeenCalledTimes(c.submitted ? 1 : 0)
      // Payload is assembled only when a submit actually happens.
      expect(deps.buildPayload).toHaveBeenCalledTimes(c.submitted ? 1 : 0)
    })
  }
})

describe('runSubmissionFlow — retry policy', () => {
  const authedEligible: SubmissionGate = { finished: true, authed: true, eligible: true }

  it('retries exactly once on a network error, then succeeds', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ id: 'r1', status: 'pending' })
    const { deps, states } = makeDeps({ submit })
    const result = await runSubmissionFlow(authedEligible, deps)
    expect(result).toBe('saved')
    expect(submit).toHaveBeenCalledTimes(2)
    expect(states).toEqual(['saving', 'saved'])
  })

  it('retries once on network error and gives up as error when it fails again', async () => {
    const submit = vi.fn().mockRejectedValue(networkError)
    const { deps } = makeDeps({ submit })
    const result = await runSubmissionFlow(authedEligible, deps)
    expect(result).toBe('error')
    expect(submit).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on a 4xx validation error', async () => {
    const submit = vi.fn().mockRejectedValue(validationError)
    const { deps } = makeDeps({ submit })
    const result = await runSubmissionFlow(authedEligible, deps)
    expect(result).toBe('error')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('degrades to guest on an immediate 401 (no retry)', async () => {
    const submit = vi.fn().mockRejectedValue(authError)
    const { deps } = makeDeps({ submit })
    const result = await runSubmissionFlow(authedEligible, deps)
    expect(result).toBe('guest')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('degrades to guest when the session drops mid-flight (network then 401)', async () => {
    const submit = vi.fn().mockRejectedValueOnce(networkError).mockRejectedValueOnce(authError)
    const { deps } = makeDeps({ submit })
    const result = await runSubmissionFlow(authedEligible, deps)
    expect(result).toBe('guest')
    expect(submit).toHaveBeenCalledTimes(2)
  })
})
