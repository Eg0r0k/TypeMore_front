import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

import {
  insertEvent,
  type CoreConfig,
  type GenerationConfig,
  type Metrics,
  type ModsDeclaration,
  type ScoreResult
} from '@shared/core'
import type { RunSubmitContext } from '@/features/run-submit/model/build-payload'

// Shared handles reachable from the hoisted module mocks below.
const h = vi.hoisted(() => ({
  submit: vi.fn(),
  authed: { value: false }
}))

// Auth status is read (read-only) from the auth entity barrel.
vi.mock('@/entities/auth', () => ({
  useAuthStore: () => ({
    get isAuth() {
      return h.authed.value
    }
  })
}))

// S1's shared API is mocked per the test contract; ApiError mirrors the real shape
// so the composable's network/401 predicates behave against real instances.
vi.mock('@shared/api', () => {
  class ApiError extends Error {
    status: number
    code: string
    constructor(shape: { status: number; code: string; message?: string }) {
      super(shape.message ?? shape.code)
      this.status = shape.status
      this.code = shape.code
    }
  }
  return {
    ApiError,
    isApiError: (value: unknown) => value instanceof ApiError,
    useSubmitRunMutation: () => ({ mutateAsync: h.submit })
  }
})

import { ApiError } from '@shared/api'
import { useRunSubmission } from '@/features/run-submit/model/use-run-submission'
import {
  bumpRestarts,
  clearRestarts,
  peekRestarts
} from '@/features/run-submit/model/restart-counter'

const config: CoreConfig = {
  mode: 'time',
  durationMs: 15000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
}
const generation: GenerationConfig = {
  mode: 'time',
  length: 15,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}
const declaration: ModsDeclaration = { blind: false, fading: false, flashlight: false }
const metrics: Metrics = {
  wpm: 80,
  raw: 85,
  accuracy: 0.97,
  consistency: 72,
  chars: { correct: 200, incorrect: 6, extra: 0, missed: 0 },
  spaces: 40,
  durationSec: 15
}
const score: ScoreResult = {
  version: 2,
  total: 1234,
  base: 1300,
  comboPeak: 50,
  accMultiplier: 0.94,
  timeBonus: null,
  modMultiplier: 1
}

const ctxWithMode = (mode: 'time' | 'words' | 'free'): RunSubmitContext => ({
  mode,
  config: { ...config, mode },
  generation: { ...generation, mode },
  declaration,
  lang: 'en',
  seed: 2864901,
  dictHash: 'a1b2c3d4',
  metrics,
  score,
  log: [insertEvent(1, 12, 't')]
})

// A mounted harness exposing the composable result at `wrapper.vm.sub`
// (`.state.value`, `.retry()`). Used by every case, so the shape is a real seam.
function mountSubmission(finished: Ref<boolean>, buildContext: () => RunSubmitContext | null) {
  return mount(
    defineComponent({
      setup() {
        const sub = useRunSubmission({ finished, buildContext })
        return { sub }
      },
      template: '<div>{{ sub.state.value }}</div>'
    })
  )
}

beforeEach(() => {
  h.submit.mockReset().mockResolvedValue({ id: 'r1', status: 'pending' })
  h.authed.value = false
  clearRestarts()
})

describe('useRunSubmission — auto-submits only for an authed, finished, eligible run', () => {
  it('submits once and reaches saved when authed + finished + eligible', async () => {
    h.authed.value = true
    const finished = ref(false)
    const wrapper = mountSubmission(finished, () => ctxWithMode('time'))

    finished.value = true
    await nextTick()
    await flushPromises()

    expect(h.submit).toHaveBeenCalledTimes(1)
    expect(h.submit.mock.calls[0][0]).toMatchObject({
      mode: 'time',
      durationMs: 15000,
      seed: 2864901,
      scoreVersion: 2
    })
    expect(wrapper.vm.sub.state.value).toBe('saved')
  })

  it('shows the guest hint and never submits when not authed', async () => {
    h.authed.value = false
    const finished = ref(false)
    const wrapper = mountSubmission(finished, () => ctxWithMode('time'))

    finished.value = true
    await nextTick()
    await flushPromises()

    expect(h.submit).not.toHaveBeenCalled()
    expect(wrapper.vm.sub.state.value).toBe('guest')
  })

  it('marks an ineligible mode without submitting', async () => {
    h.authed.value = true
    const finished = ref(false)
    const wrapper = mountSubmission(finished, () => ctxWithMode('free'))

    finished.value = true
    await nextTick()
    await flushPromises()

    expect(h.submit).not.toHaveBeenCalled()
    expect(wrapper.vm.sub.state.value).toBe('ineligible')
  })

  it('resets to idle when a fresh run starts (finished flips back to false)', async () => {
    h.authed.value = true
    const finished = ref(true)
    const wrapper = mountSubmission(finished, () => ctxWithMode('time'))
    await flushPromises()
    expect(wrapper.vm.sub.state.value).toBe('saved')

    finished.value = false
    await nextTick()
    expect(wrapper.vm.sub.state.value).toBe('idle')
  })
})

describe('useRunSubmission — abandoned-run count rides the payload (RUNS.md restartsSinceLastSubmit)', () => {
  it('reports the accumulated count and clears it once the run is saved', async () => {
    h.authed.value = true
    bumpRestarts()
    bumpRestarts()
    bumpRestarts()

    const finished = ref(false)
    mountSubmission(finished, () => ctxWithMode('time'))
    finished.value = true
    await nextTick()
    await flushPromises()

    expect(h.submit.mock.calls[0][0]).toMatchObject({ restartsSinceLastSubmit: 3 })
    // Accepted → the reported window closed.
    expect(peekRestarts()).toBe(0)
  })

  it('omits the field at zero — exactly what a pre-field client submits', async () => {
    h.authed.value = true
    const finished = ref(false)
    mountSubmission(finished, () => ctxWithMode('time'))
    finished.value = true
    await nextTick()
    await flushPromises()

    expect('restartsSinceLastSubmit' in h.submit.mock.calls[0][0]).toBe(false)
  })

  it('keeps the count when the submission fails — a later attempt still reports it', async () => {
    h.authed.value = true
    h.submit
      .mockReset()
      .mockRejectedValue(new ApiError({ status: 0, code: 'network_error' }))
    bumpRestarts()

    const finished = ref(false)
    const wrapper = mountSubmission(finished, () => ctxWithMode('time'))
    finished.value = true
    await nextTick()
    await flushPromises()

    expect(wrapper.vm.sub.state.value).toBe('error')
    expect(peekRestarts()).toBe(1)
  })
})

describe('useRunSubmission — retry button re-submits after a network failure', () => {
  it('recovers to saved when a retry succeeds', async () => {
    h.authed.value = true
    h.submit
      .mockReset()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'network_error' }))
      .mockRejectedValueOnce(new ApiError({ status: 0, code: 'network_error' }))

    const finished = ref(false)
    const wrapper = mountSubmission(finished, () => ctxWithMode('time'))

    finished.value = true
    await nextTick()
    await flushPromises()
    // One automatic retry already consumed both rejections → error.
    expect(h.submit).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.sub.state.value).toBe('error')

    h.submit.mockResolvedValue({ id: 'r1', status: 'pending' })
    wrapper.vm.sub.retry()
    await flushPromises()
    expect(wrapper.vm.sub.state.value).toBe('saved')
  })
})
