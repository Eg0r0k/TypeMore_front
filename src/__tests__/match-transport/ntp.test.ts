// PROTOCOL.md §4 clock-offset procedure: offset/rtt math, the 3× min-rtt
// outlier filter, median selection, and the full sampling loop over loopback.
import { describe, expect, it } from 'vitest'

import {
  type NtpSample,
  type TransportEvent,
  LoopbackServer,
  LoopbackTransport,
  NTP_MIN_SAMPLES,
  computeNtp,
  sampleNtp
} from '@shared/match-transport'

/**
 * Builds a pair for a true server−client offset with directional latencies:
 * ping takes `up` ms, pong takes `down` ms, server handling is instant.
 * Expected per-pair estimate: `offset + (up − down) / 2`, rtt: `up + down`.
 */
const pair = (offset: number, up: number, down: number, t0 = 1_000_000): NtpSample => ({
  t0,
  t1: t0 + up + offset,
  t2: t0 + up + offset,
  t3: t0 + up + down
})

describe('computeNtp', () => {
  it('recovers the exact offset under symmetric latency', () => {
    const samples = [10, 12, 11, 14, 13].map((lat) => pair(500, lat, lat))
    const result = computeNtp(samples)
    expect(result.offset).toBe(500)
    expect(result.minRtt).toBe(20)
    expect(result.usedSamples).toBe(5)
    expect(result.discarded).toBe(0)
  })

  it('discards jittered outliers with rtt > 3× min rtt', () => {
    const good = [10, 11, 12, 10].map((lat) => pair(500, lat, lat)) // rtt 20-24
    const outlier = pair(500, 180, 20) // rtt 200 > 3×20; skewed estimate 500 + 80 = 580
    const result = computeNtp([...good, outlier])
    expect(result.discarded).toBe(1)
    expect(result.usedSamples).toBe(4)
    expect(result.offset).toBe(500) // the 580 estimate never touches the median
  })

  it('keeps a pair at exactly 3× the minimum rtt (inclusive bound)', () => {
    const samples = [pair(500, 10, 10), pair(500, 30, 30), pair(500, 12, 12)]
    expect(computeNtp(samples).discarded).toBe(0) // rtt 60 == 3×20 survives
  })

  it('takes the median offset: middle value for odd, mean of middles for even counts', () => {
    // Odd: asymmetric routes give per-pair estimates 495, 500, 505 → median 500.
    const odd = [pair(500, 10, 20), pair(500, 15, 15), pair(500, 20, 10)]
    expect(computeNtp(odd).offset).toBe(500)
    // Even: estimates 495, 499, 501, 505 → (499 + 501) / 2 = 500.
    const even = [pair(500, 10, 20), pair(500, 14, 16), pair(500, 16, 14), pair(500, 20, 10)]
    expect(computeNtp(even).offset).toBe(500)
  })

  it('throws on an empty sample set', () => {
    expect(() => computeNtp([])).toThrow()
  })
})

describe('sampleNtp', () => {
  it('measures the simulated server clock offset over loopback exactly', async () => {
    // A frozen injected clock on both ends makes the run fully deterministic:
    // zero-latency delivery consumes no simulated time, so rtt is exactly 0.
    const frozen = 5_000_000
    const now = () => frozen
    const server = new LoopbackServer({ clockOffsetMs: 1234, now })
    const t = new LoopbackTransport(server)
    await t.connect()

    const sync = await sampleNtp(t, { now })
    expect(sync.offset).toBe(1234)
    expect(sync.minRtt).toBe(0)
    expect(sync.usedSamples).toBe(NTP_MIN_SAMPLES)
    expect(sync.toLocalTime(6_001_234)).toBe(6_000_000)
    expect(sync.toServerTime(6_000_000)).toBe(6_001_234)
  })

  it('raises the requested pair count to the protocol minimum of 5', async () => {
    const server = new LoopbackServer()
    const t = new LoopbackTransport(server)
    const events: TransportEvent[] = []
    t.onEvent((event) => events.push(event))
    await t.connect()

    await sampleNtp(t, { samples: 2 })
    expect(events.filter((event) => event.type === 'ntp_pong')).toHaveLength(NTP_MIN_SAMPLES)
  })
})
