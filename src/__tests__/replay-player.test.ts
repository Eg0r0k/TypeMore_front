/**
 * Replay shows the run AS THE PLAYER EXPERIENCED IT.
 *
 * The player is driven entirely by the run's stored `ReplayData`: the CoreConfig
 * + words feed the ghost core, and the ModsDeclaration decides what the field
 * renders. The "view as the player saw it" switch gates the VISUAL layer only —
 * the core, the log and the chip row never move with it. The config-store mock
 * below is the hard half of the GameView contract: any read from this render
 * path (the player, the field, or anything they mount) throws.
 */
import { type VueWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/entities/config/model/store', () => ({
  useConfigStore: () => {
    throw new Error('the replay path must never read the viewer config store')
  }
}))

import { ReplayPlayer } from '@/features/test/replay'
import { Test } from '@/widgets/test'
import type { GameView, ReplayData } from '@entities/game'
import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  type GenerationConfig,
  type ModsDeclaration,
  type ScoreResult,
  DEFAULT_MAX_EXTRA_CHARS,
  asMs,
  commitEvent,
  computeMetrics,
  foldLog,
  insertEvent,
  isTelemetryEvent
} from '@typemore/core'

import { withTelemetry, withoutSeq } from './fixtures/telemetry-twin'
import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/app/i18n/locales/en'

config.global.plugins.push(createI18n({ legacy: false, locale: 'en', messages: { en } }))

const WORDS = ['hello', 'world'] as const

const coreConfig = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 0,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0,
  ...over
})

const generation = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  mode: 'words',
  length: 2,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  ...over
})

const score: ScoreResult = {
  version: 2,
  total: 1234,
  base: 900,
  comboPeak: 40,
  accMultiplier: 0.96,
  timeBonus: null,
  modMultiplier: 1.35
}

// 'h' then a typo 'x' — the second letter is what blind has to mask.
const log: readonly GameEvent[] = [insertEvent(1, 0, 'h'), insertEvent(2, 100, 'x')]

const replayOf = (declaration: ModsDeclaration, over: Partial<ReplayData> = {}): ReplayData => ({
  config: coreConfig(),
  words: [...WORDS],
  log,
  generation: generation(),
  declaration,
  score,
  grade: 'A',
  ...over
})

const NONE: ModsDeclaration = { blind: false, fading: false, flashlight: false }

// Manual rAF + performance clock: the player advances its virtual clock from
// frame deltas, so driving both makes playback deterministic instead of timing-
// dependent.
let clock = 0
let frames: FrameRequestCallback[] = []

beforeEach(() => {
  clock = 0
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const mountReplay = (replay: ReplayData) =>
  mount(ReplayPlayer, { props: { replay }, attachTo: document.body })

/** Run the queued frames after advancing the clock by `ms` of playback time. */
async function play(ms: number): Promise<void> {
  clock += ms
  const due = frames
  frames = []
  for (const cb of due) cb(clock)
  await nextTick()
  await nextTick()
}

const fieldOf = (wrapper: VueWrapper) => wrapper.findComponent(Test)
const viewOf = (wrapper: VueWrapper): GameView => fieldOf(wrapper).props('store') as GameView
const wordsRootOf = (wrapper: VueWrapper): ShadowRoot => {
  const host = wrapper.find('.game__host').element as HTMLElement
  if (!host.shadowRoot) throw new Error('field shadow root not mounted')
  return host.shadowRoot
}
const chipsOf = (wrapper: VueWrapper): string[] =>
  wrapper.findAll('[data-testid="replay-mods"] [data-mod]').map((li) => li.attributes('data-mod')!)

describe('replay renders the run under its own stored mods', () => {
  it('applies the declared view mods to the replay field', async () => {
    const wrapper = mountReplay(replayOf({ blind: false, fading: true, flashlight: true }))
    await nextTick()
    await nextTick()

    expect(fieldOf(wrapper).props('fading')).toBe(true)
    expect(fieldOf(wrapper).props('flashlight')).toBe(true)
    const words = wordsRootOf(wrapper).querySelector('.game__words')
    expect(words?.classList.contains('tm-fading')).toBe(true)
    expect(words?.classList.contains('tm-flashlight')).toBe(true)

    wrapper.unmount()
  })

  it('renders a mod-free run plain, with no view switch to offer', async () => {
    const wrapper = mountReplay(replayOf(NONE))
    await nextTick()
    await nextTick()

    expect(fieldOf(wrapper).props('fading')).toBe(false)
    expect(fieldOf(wrapper).props('flashlight')).toBe(false)
    expect(viewOf(wrapper).blind).toBe(false)
    const words = wordsRootOf(wrapper).querySelector('.game__words')
    expect(words?.classList.contains('tm-fading')).toBe(false)
    expect(wrapper.find('[data-testid="replay-as-seen"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it("drives the core from the run's stored setup, not the viewer's", async () => {
    const replay = replayOf(NONE, { config: coreConfig({ nospace: true, difficulty: 'master' }) })
    const wrapper = mountReplay(replay)
    await nextTick()
    await play(200)

    // Words and reducer behaviour come from the stored snapshot: under nospace
    // the ghost core auto-commits a completed word — a rule the viewer cannot
    // influence, because there is no viewer config in this path at all.
    expect(viewOf(wrapper).words).toEqual([...WORDS])
    expect(viewOf(wrapper).snapshot.input[0]).toBe('hx')

    wrapper.unmount()
  })
})

describe('view-as-the-player switch', () => {
  it('defaults ON for fading/flashlight and OFF for blind', async () => {
    const visual = mountReplay(replayOf({ blind: false, fading: true, flashlight: false }))
    await nextTick()
    expect(fieldOf(visual).props('fading')).toBe(true)
    visual.unmount()

    const blind = mountReplay(replayOf({ blind: true, fading: false, flashlight: false }))
    await nextTick()
    // Blind hides correctness — the whole point of watching — so it starts off.
    expect(viewOf(blind).blind).toBe(false)
    expect(blind.find('[data-testid="replay-as-seen"]').exists()).toBe(true)
    blind.unmount()
  })

  it('flips only the visual layer: the core, log and chips never move', async () => {
    const wrapper = mountReplay(replayOf({ blind: false, fading: true, flashlight: true }))
    await nextTick()
    await play(200)

    const before = viewOf(wrapper).snapshot
    const chips = chipsOf(wrapper)

    await wrapper.find('[data-testid="replay-as-seen"]').trigger('click')
    await nextTick()

    expect(fieldOf(wrapper).props('fading')).toBe(false)
    expect(fieldOf(wrapper).props('flashlight')).toBe(false)
    expect(
      wordsRootOf(wrapper).querySelector('.game__words')?.classList.contains('tm-fading')
    ).toBe(false)
    // Same state object: no core rebuild, no re-fold, no lost progress.
    expect(viewOf(wrapper).snapshot).toBe(before)
    expect(viewOf(wrapper).words).toEqual([...WORDS])
    expect(chipsOf(wrapper)).toEqual(chips)

    wrapper.unmount()
  })

  it('masks correctness exactly when blind is switched on', async () => {
    const wrapper = mountReplay(replayOf({ blind: true, fading: false, flashlight: false }))
    await nextTick()
    await play(200)

    // Off by default: the typo is visible, which is why the toggle exists.
    const letters = () => [
      ...wordsRootOf(wrapper).querySelectorAll('.word')[0].querySelectorAll('.letter')
    ]
    expect(letters()[1].classList.contains('incorrect')).toBe(true)

    await wrapper.find('[data-testid="replay-as-seen"]').trigger('click')
    await nextTick()

    expect(viewOf(wrapper).blind).toBe(true)
    expect(letters()[1].classList.contains('incorrect')).toBe(false)
    expect(letters()[1].classList.contains('correct')).toBe(true)
    expect(wordsRootOf(wrapper).querySelector('.word--error')).toBeNull()

    wrapper.unmount()
  })
})

describe('seeking', () => {
  /** The bar reports a fixed 100px-wide box, so clientX maps 1:1 onto percent. */
  const seekBarOf = (wrapper: VueWrapper) => {
    const seek = wrapper.find('[data-testid="replay-seek"]')
    vi.spyOn(seek.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 4,
      height: 4,
      x: 0,
      y: 0,
      toJSON: () => ({})
    } as DOMRect)
    return seek
  }

  it('scrubs forward and backward along the run', async () => {
    const wrapper = mountReplay(replayOf(NONE))
    await nextTick()

    const seek = seekBarOf(wrapper)

    // Forward to the end of the 100ms log: both keystrokes on screen.
    await seek.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    await seek.trigger('pointerup', { pointerId: 1 })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('hx')

    // Backward to the middle: the driver re-folds from zero, one keystroke.
    await seek.trigger('pointerdown', { clientX: 50, pointerId: 1 })
    await seek.trigger('pointerup', { pointerId: 1 })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('h')

    wrapper.unmount()
  })

  it('a drag scrubs continuously while the pointer is down, one fold per frame', async () => {
    const wrapper = mountReplay(replayOf(NONE))
    await nextTick()

    const seek = seekBarOf(wrapper)

    await seek.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('hx')

    // Moves only RECORD the target; the fold lands on the next frame — a
    // pointer stream outpaces the display, and a backward seek re-folds the
    // log prefix each time.
    await seek.trigger('pointermove', { clientX: 10, pointerId: 1 })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('hx')
    await play(0)
    expect(viewOf(wrapper).snapshot.input[0]).toBe('h')

    await seek.trigger('pointerup', { pointerId: 1 })

    // Released: further moves no longer seek, even across frames.
    await seek.trigger('pointermove', { clientX: 100, pointerId: 1 })
    await play(0)
    expect(viewOf(wrapper).snapshot.input[0]).toBe('h')

    wrapper.unmount()
  })

  it('releasing mid-drag applies the last pointer position immediately', async () => {
    const wrapper = mountReplay(replayOf(NONE))
    await nextTick()

    const seek = seekBarOf(wrapper)

    await seek.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    await seek.trigger('pointermove', { clientX: 10, pointerId: 1 })
    // No frame between the move and the release: pointerup must not lose it.
    await seek.trigger('pointerup', { pointerId: 1 })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('h')

    wrapper.unmount()
  })

  it('marks mistyped keystrokes along the seek bar', async () => {
    const wrapper = mountReplay(replayOf(NONE))
    await nextTick()

    // The log is 'h' (correct) then 'x' against 'hello' (incorrect, at t=100
    // of a 100ms run): exactly one tick, parked at the very end of the bar,
    // carrying the word the mistake landed in as its hover tooltip.
    const marks = wrapper.findAll('.replay__error-mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].attributes('style')).toContain('left: 100%')
    expect(marks[0].find('.replay__error-word').text()).toBe('hello')

    wrapper.unmount()
  })

  it('arrow keys nudge the position from the keyboard', async () => {
    const wrapper = mountReplay(replayOf(NONE))
    await nextTick()

    const seek = wrapper.find('[data-testid="replay-seek"]')
    // The whole 100ms run fits inside one 5s nudge.
    await seek.trigger('keydown', { key: 'ArrowRight' })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('hx')
    // Back to t=0 — which still dispatches the t=0 keystroke, and only it.
    await seek.trigger('keydown', { key: 'ArrowLeft' })
    expect(viewOf(wrapper).snapshot.input[0]).toBe('h')

    wrapper.unmount()
  })
})

/**
 * A log-v2 run in the replay player.
 *
 * The player is a `GhostDriver` at zero display delay, so it DISPATCHES every
 * event it is handed — telemetry included — and relies on the reducer answering
 * with the same state object. Until now no v2 log ever entered this path: the
 * whole feature was pinned on v1 logs only, and a regression in the no-op
 * handling would have surfaced first in front of a viewer.
 *
 * The property here is the playback one, not just the endpoint: at EVERY
 * checkpoint along the timeline the v2 run renders exactly what its v1 twin
 * renders, `lastSeq` aside (telemetry consumes seq, it never writes state).
 */
describe('a v2 log plays exactly like its v1 twin', () => {
  // A complete two-word run: every letter, a commit after each word — the last
  // commit finishes it. 70ms apart, which clears the ±8/25ms telemetry offsets.
  const twinLog: readonly GameEvent[] = (() => {
    const out: GameEvent[] = []
    let seq = 0
    let t = 0
    for (const word of WORDS) {
      for (const char of word) out.push(insertEvent(++seq, (t += 70), char))
      out.push(commitEvent(++seq, (t += 70)))
    }
    return out
  })()
  const v2Log = withTelemetry(twinLog)
  const ctx: CoreContext = { config: coreConfig(), words: [...WORDS] }
  const endT = v2Log[v2Log.length - 1].t

  /** Mount a player over `log` and read its view at each checkpoint in turn. */
  async function playbackOf(log: readonly GameEvent[], checkpoints: readonly number[]) {
    const wrapper = mountReplay(replayOf(NONE, { log }))
    await nextTick()
    const frames: { snapshot: unknown; wordIndex: number; finished: boolean }[] = []
    let at = 0
    for (const checkpoint of checkpoints) {
      await play(checkpoint - at)
      at = checkpoint
      const view = viewOf(wrapper)
      frames.push({
        snapshot: withoutSeq(view.snapshot),
        wordIndex: view.wordIndex,
        finished: view.finished
      })
    }
    const last = viewOf(wrapper).snapshot
    wrapper.unmount()
    return { frames, last }
  }

  it('renders the same frame at every point along the timeline', async () => {
    // Dense enough to land between a key-down and the insert it produced.
    const checkpoints = Array.from({ length: 40 }, (_, i) => Math.round(((i + 1) * endT) / 32))

    const v1 = await playbackOf(twinLog, checkpoints)
    const v2 = await playbackOf(v2Log, checkpoints)

    expect(v2.frames).toEqual(v1.frames)
    // Not vacuous: the run actually progressed and actually ended.
    expect(v1.frames[0].wordIndex).toBe(0)
    expect(v1.frames[v1.frames.length - 1].finished).toBe(true)
  })

  it('ends on the v1 twin’s fold, and on its own log’s fold bit for bit', async () => {
    const checkpoints = [endT + 500]
    const v2 = await playbackOf(v2Log, checkpoints)

    // Exact against the log it was actually fed…
    expect(v2.last).toEqual(foldLog(ctx, v2Log)._unsafeUnwrap())
    // …and identical to the v1 twin apart from the seq counter.
    expect(withoutSeq(v2.last)).toEqual(withoutSeq(foldLog(ctx, twinLog)._unsafeUnwrap()))
    expect(v2.frames[0].finished).toBe(true)
  })

  it('measures the run off the state events alone', async () => {
    const folded = foldLog(ctx, v2Log)._unsafeUnwrap()
    const end = folded.finishedAt ?? asMs(endT)
    expect(computeMetrics(ctx, v2Log, end)).toEqual(computeMetrics(ctx, twinLog, end))
    // The v2 log is a v2 log: telemetry really is in there being dispatched.
    expect(v2Log.filter(isTelemetryEvent).length).toBe(twinLog.length * 2)
  })

  it('seeks identically: a scrub lands on the same frame in both captures', async () => {
    const seekAt = Math.round(endT / 2)
    const frames = async (log: readonly GameEvent[]) => {
      const wrapper = mountReplay(replayOf(NONE, { log }))
      await nextTick()
      const seek = wrapper.find('[data-testid="replay-seek"]')
      vi.spyOn(seek.element, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        right: 100,
        bottom: 4,
        height: 4,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect)
      const durationMs = log[log.length - 1].t
      // Forward, then BACKWARD — the backward branch re-folds the whole prefix
      // from zero, which is the path that would choke on an unexpected kind.
      await seek.trigger('pointerdown', { clientX: 100, pointerId: 1 })
      await seek.trigger('pointerup', { pointerId: 1 })
      const atEnd = withoutSeq(viewOf(wrapper).snapshot)
      await seek.trigger('pointerdown', {
        clientX: Math.round((seekAt / durationMs) * 100),
        pointerId: 1
      })
      await seek.trigger('pointerup', { pointerId: 1 })
      const atHalf = withoutSeq(viewOf(wrapper).snapshot)
      wrapper.unmount()
      return { atEnd, atHalf }
    }

    expect(await frames(v2Log)).toEqual(await frames(twinLog))
  })
})

describe('replay header', () => {
  it('reports the stored score, grade, mod multiplier and score version', async () => {
    const wrapper = mountReplay(replayOf({ blind: false, fading: true, flashlight: false }))
    await nextTick()

    expect(wrapper.find('[data-testid="replay-grade"]').text()).toBe('A')
    expect(wrapper.find('[data-testid="replay-score"]').text()).toBe('1234')
    expect(wrapper.find('[data-testid="replay-mod-multiplier"]').text()).toContain('1.35')
    expect(wrapper.find('[data-testid="replay-score-version"]').text()).toContain('v2')

    wrapper.unmount()
  })

  it('chips list the stored declaration beside the verifiable setup', async () => {
    const wrapper = mountReplay(
      replayOf(
        { blind: true, fading: false, flashlight: true },
        {
          config: coreConfig({ nospace: true }),
          generation: generation({ punctuation: true })
        }
      )
    )
    await nextTick()

    expect(chipsOf(wrapper)).toEqual(['punctuation', 'nospace', 'blind', 'flashlight'])

    wrapper.unmount()
  })
})
