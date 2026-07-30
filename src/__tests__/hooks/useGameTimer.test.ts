import { describe, expect, it } from 'vitest'

import { type TimerCommand, type TimerTick, GameCore, insertEvent } from '@typemore/core'
import { type TimerWorkerLike, useGameTimer } from '@shared/lib/hooks/useGameTimer'

class FakeWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  readonly sent: TimerCommand[] = []

  postMessage(message: TimerCommand): void {
    this.sent.push(message)
  }

  terminate(): void {}

  emitTick(elapsedMs: number): void {
    const tick: TimerTick = { type: 'tick', elapsedMs }
    // Only `data` is read by the handler; a full MessageEvent is unnecessary.
    this.onmessage?.({ data: tick } as unknown as MessageEvent<TimerTick>)
  }
}

describe('useGameTimer', () => {
  it('forwards commands to the worker', () => {
    const fake = new FakeWorker()
    const timer = useGameTimer(() => fake)
    timer.start(15_000)
    timer.stop()
    timer.reset()
    expect(fake.sent).toEqual([
      { cmd: 'start', durationMs: 15_000 },
      { cmd: 'stop' },
      { cmd: 'reset' }
    ])
  })

  it('converts elapsedMs into the event timebase for onTick', () => {
    const fake = new FakeWorker()
    const timer = useGameTimer(() => fake)
    let received: number | null = null
    timer.onTick((nowMs) => {
      received = nowMs
    })
    fake.emitTick(1234)
    expect(received).toBe(1234)
  })

  // Frozen tab: suspended well past the deadline. The worker kept running; its
  // next delivered tick reports the true elapsed. settle must finish the test
  // exactly at the deadline, never at the late wake instant.
  it('finishes a timed test at the deadline when a late tick arrives via the worker', () => {
    const core = new GameCore({
      config: {
        mode: 'time',
        durationMs: 10_000,
        maxExtraChars: 20,
        difficulty: 'normal',
        nospace: false
      },
      words: ['a', 'b', 'c']
    })
    core.dispatch(insertEvent(1, 0, 'a')) // start at t = 0

    const fake = new FakeWorker()
    const timer = useGameTimer(() => fake)
    timer.onTick((nowMs) => core.tick(nowMs))
    timer.start(10_000)

    expect(core.state.phase).toBe('running')
    fake.emitTick(25_000) // woke 15s past the deadline
    expect(core.state.phase).toBe('finished')
    expect(core.state.finishedAt).toBe(10_000)
  })
})
