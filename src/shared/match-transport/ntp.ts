import type { MatchTransport } from './transport'

/**
 * NTP-style clock offset against the server (PROTOCOL.md §4, verbatim):
 *
 * 1. ≥ 5 `ntp_ping`/`ntp_pong` pairs before any countdown.
 * 2. Per pair: `offset = ((t1 − t0) + (t2 − t3)) / 2`,
 *    `rtt = (t3 − t0) − (t2 − t1)`.
 * 3. Discard pairs whose rtt exceeds 3× the minimum observed rtt.
 * 4. Use the median offset of the survivors.
 *
 * `offset` is `serverClock − clientClock`: `localGoTime = goAtServerMs − offset`.
 */

export const NTP_MIN_SAMPLES = 5
export const NTP_RTT_OUTLIER_FACTOR = 3

/** One completed ping/pong pair. `t3` is client-local and never on the wire. */
export interface NtpSample {
  readonly t0: number
  readonly t1: number
  readonly t2: number
  readonly t3: number
}

export interface NtpComputation {
  /** Median offset (serverClock − clientClock) of the surviving pairs, in ms. */
  readonly offset: number
  readonly minRtt: number
  /** Pairs that survived the 3× min-rtt filter. */
  readonly usedSamples: number
  /** Pairs discarded as jittered outliers. */
  readonly discarded: number
}

export interface NtpSync extends NtpComputation {
  /** `serverMs − offset`: converts a server-clock instant (e.g. `goAtServerMs`) to the local clock. */
  toLocalTime(serverMs: number): number
  /** `localMs + offset`: converts a local-clock instant to the server clock. */
  toServerTime(localMs: number): number
}

/** Pure §4 math over completed pairs — the sampling I/O lives in `sampleNtp`. */
export function computeNtp(samples: readonly NtpSample[]): NtpComputation {
  if (samples.length === 0) throw new Error('computeNtp requires at least one sample')
  const pairs = samples.map(({ t0, t1, t2, t3 }) => ({
    offset: (t1 - t0 + (t2 - t3)) / 2,
    rtt: t3 - t0 - (t2 - t1)
  }))
  const minRtt = Math.min(...pairs.map((pair) => pair.rtt))
  const survivors = pairs.filter((pair) => pair.rtt <= NTP_RTT_OUTLIER_FACTOR * minRtt)
  const offsets = survivors.map((pair) => pair.offset).sort((a, b) => a - b)
  const mid = Math.floor(offsets.length / 2)
  const offset = offsets.length % 2 === 1 ? offsets[mid] : (offsets[mid - 1] + offsets[mid]) / 2
  return {
    offset,
    minRtt,
    usedSamples: survivors.length,
    discarded: pairs.length - survivors.length
  }
}

export interface SampleNtpOptions {
  /** Pair count; values below the protocol minimum of 5 are raised to 5. */
  readonly samples?: number
  /** Client clock, injectable for tests. Default `Date.now`. */
  readonly now?: () => number
  /** Per-pair pong timeout. Default 2000. */
  readonly timeoutMs?: number
}

/**
 * Collect `count` completed pairs, sequentially: one outstanding pair at a
 * time, so a pong matches the ping it answers without a correlation id.
 */
async function collectSamples(
  transport: MatchTransport,
  count: number,
  now: () => number,
  timeoutMs: number
): Promise<NtpSample[]> {
  const samples: NtpSample[] = []
  for (let i = 0; i < count; i++) {
    const t0 = now()
    const pong = await new Promise<{ t0: number; t1: number; t2: number }>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe()
        reject(new Error(`ntp_pong timed out after ${timeoutMs}ms (pair ${i + 1}/${count})`))
      }, timeoutMs)
      const unsubscribe = transport.onEvent((event) => {
        if (event.type !== 'ntp_pong') return
        clearTimeout(timer)
        unsubscribe()
        resolve(event)
      })
      try {
        transport.send({ type: 'ntp_ping', t0 })
      } catch (cause) {
        clearTimeout(timer)
        unsubscribe()
        reject(cause instanceof Error ? cause : new Error(String(cause)))
      }
    })
    samples.push({ t0: pong.t0, t1: pong.t1, t2: pong.t2, t3: now() })
  }
  return samples
}

/**
 * Run the full §4 procedure over a connected transport, then fold the pairs
 * through {@link computeNtp}.
 */
export async function sampleNtp(
  transport: MatchTransport,
  options?: SampleNtpOptions
): Promise<NtpSync> {
  const count = Math.max(options?.samples ?? NTP_MIN_SAMPLES, NTP_MIN_SAMPLES)
  const now = options?.now ?? Date.now
  const samples = await collectSamples(transport, count, now, options?.timeoutMs ?? 2000)

  const computation = computeNtp(samples)
  return {
    ...computation,
    toLocalTime: (serverMs) => serverMs - computation.offset,
    toServerTime: (localMs) => localMs + computation.offset
  }
}

/**
 * Round-trip time to the server, in ms — the ping, and nothing else.
 *
 * Deliberately NOT `sampleNtp().minRtt`: that call also produces a clock
 * offset, and the offset is what anchors a countdown. Re-running it to refresh
 * a number on a lobby screen would move `t = 0` for a match in flight. This
 * one computes the same §4 `rtt = (t3 − t0) − (t2 − t1)` and throws the offset
 * away, so measuring the ping can never move the clock.
 *
 * The MINIMUM of the samples, not the mean: rtt is bounded below by the true
 * path latency and inflated by scheduling jitter on both ends, so the smallest
 * observation is the closest thing to the real number. Same reason §4 filters
 * outliers against `minRtt` rather than against an average.
 *
 * Three samples by default rather than five — nothing downstream depends on
 * this figure, so it is cheap on purpose.
 */
export async function measureRtt(
  transport: MatchTransport,
  options?: SampleNtpOptions
): Promise<number> {
  const count = Math.max(options?.samples ?? 3, 1)
  const now = options?.now ?? Date.now
  const samples = await collectSamples(transport, count, now, options?.timeoutMs ?? 2000)
  return Math.min(...samples.map(({ t0, t1, t2, t3 }) => t3 - t0 - (t2 - t1)))
}
