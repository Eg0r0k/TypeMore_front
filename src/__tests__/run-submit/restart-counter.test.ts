import { beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_RESTARTS,
  bumpRestarts,
  clearRestarts,
  peekRestarts
} from '@/features/run-submit/model/restart-counter'

/**
 * The abandoned-run counter behind RUNS.md `restartsSinceLastSubmit`: counts
 * survive a "reload" (localStorage), never leave the server's accepted range,
 * and degrade to zero — not to NaN — on storage garbage.
 */

const KEY = 'runs-restarts-since-submit'

beforeEach(() => {
  window.localStorage.clear()
})

describe('restart counter', () => {
  it('starts at zero, counts bumps, and clears on report', () => {
    expect(peekRestarts()).toBe(0)
    bumpRestarts()
    bumpRestarts()
    bumpRestarts()
    expect(peekRestarts()).toBe(3)
    clearRestarts()
    expect(peekRestarts()).toBe(0)
  })

  it('persists through a page death — the value lives in localStorage', () => {
    bumpRestarts()
    // A fresh page would re-read storage; peek IS that re-read (no module state).
    expect(window.localStorage.getItem(KEY)).toBe('1')
    window.localStorage.setItem(KEY, '41')
    expect(peekRestarts()).toBe(41)
    bumpRestarts()
    expect(peekRestarts()).toBe(42)
  })

  it('caps at the server validation ceiling — out of range would 422 the NEXT run', () => {
    window.localStorage.setItem(KEY, String(MAX_RESTARTS))
    bumpRestarts()
    expect(peekRestarts()).toBe(MAX_RESTARTS)
    window.localStorage.setItem(KEY, '999999')
    expect(peekRestarts()).toBe(MAX_RESTARTS)
  })

  it('reads storage garbage as zero, never NaN or a negative', () => {
    window.localStorage.setItem(KEY, 'garbage')
    expect(peekRestarts()).toBe(0)
    window.localStorage.setItem(KEY, '-5')
    expect(peekRestarts()).toBe(0)
    bumpRestarts()
    expect(peekRestarts()).toBe(1)
  })
})
