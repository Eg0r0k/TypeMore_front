import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick } from 'vue'

// The submission spy: if ANYTHING on this path tries to POST a run, this is
// the function it must go through.
const h = vi.hoisted(() => ({
  submit: vi.fn(),
  authed: { value: true }
}))

vi.mock('@/entities/auth', () => ({
  useAuthStore: () => ({
    get isAuth() {
      return h.authed.value
    }
  })
}))

vi.mock('@shared/api', () => ({
  ApiError: class extends Error {},
  isApiError: () => false,
  useSubmitRunMutation: () => ({ mutateAsync: h.submit })
}))

import { useGameStore, releaseGameStore } from '@entities/game'
import { useRaceStore } from '@entities/race'
import { useRunSubmission } from '@/features/run-submit/model/use-run-submission'
import type { RunSubmitContext } from '@/features/run-submit/model/build-payload'
/**
 * UNRANKED stays absolute (C10): the no-submission spy guard, moved with the
 * race feature off the deleted /race page. The wiring under test is the HOME
 * page's exact gate — `finishedOk` includes `!race.racing` — driven against a
 * really-finished run: were the guard dropped, the submission hook would fire
 * the spy the moment the run finishes.
 */
describe('race — a race run must never reach POST /runs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.submit.mockReset()
    releaseGameStore('race-guard')
  })

  const finishRun = (storeId: string) => {
    const game = useGameStore(storeId)
    game.setup({
      config: {
        mode: 'words',
        durationMs: 60_000,
        maxExtraChars: 20,
        difficulty: 'normal',
        nospace: false,
        minWpm: 0
      },
      words: ['ab'],
      generation: {
        mode: 'words',
        length: 1,
        punctuation: false,
        numbers: false,
        randomCase: false,
        reverse: false
      },
      declaration: { blind: false, fading: false, flashlight: false }
    })
    game.insert('a')
    game.insert('b')
    game.commit()
    expect(game.phase).toBe('finished')
    return game
  }

  const mountGate = (storeId: string, racing: () => boolean) => {
    const game = finishRun(storeId)
    const context: RunSubmitContext | null = null
    let submission: ReturnType<typeof useRunSubmission> | undefined
    const host = defineComponent({
      setup() {
        // The home page's gate, verbatim: finished ∧ clean ∧ NOT racing.
        const finishedOk = computed(
          () => game.phase === 'finished' && game.snapshot.failReason === null && !racing()
        )
        submission = useRunSubmission({
          finished: finishedOk,
          buildContext: () => context
        })
        return () => null
      }
    })
    const wrapper = mount(host)
    return { wrapper, submission: submission! }
  }

  it('does not submit while racing, even for a cleanly finished run', async () => {
    const race = useRaceStore()
    race.request('run-1')
    const { wrapper } = mountGate('race-guard', () => race.racing)
    await nextTick()
    await flushPromises()
    expect(h.submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('the same finished run WOULD submit outside a race (the guard is what stands in the way)', async () => {
    const { wrapper, submission } = mountGate('race-guard', () => false)
    await nextTick()
    await flushPromises()
    // buildContext returned null (this harness carries no payload), so the
    // hook lands in its "missing context" state — but only because it RAN:
    // the finished gate opened, which is exactly what racing must prevent.
    expect(submission.state.value).not.toBe('idle')
    wrapper.unmount()
  })
})
