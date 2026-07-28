import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { RACE_SNAPSHOT_KEYS, useRaceStore } from '@entities/race'
import { configState, setConfig } from '@/shared/lib/helpers/config'
import DEFAULT_CONFIG from '@/shared/constants/default-config'

/**
 * The race store's settings contract (C10): entering a race snapshots the
 * player's core-bound settings and applies the record's wholesale; exiting
 * restores the snapshot EXACTLY — the round-trip the task demands a test for.
 */

const resetConfig = (): void => {
  for (const key of RACE_SNAPSHOT_KEYS) {
    setConfig(key, DEFAULT_CONFIG[key])
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  resetConfig()
})

describe('race store — snapshot / restore round-trip', () => {
  it('applies the record’s settings over the player’s and restores them exactly on exit', () => {
    // The player's own, deliberately non-default setup.
    setConfig('mode', 'time')
    setConfig('time', 60)
    setConfig('punctuation', true)
    setConfig('difficulty', 'expert')
    const own = Object.fromEntries(RACE_SNAPSHOT_KEYS.map((key) => [key, configState[key]]))

    const race = useRaceStore()
    race.request('run-1')
    expect(race.racing).toBe(true)

    // The record: a words-50 run with different mods.
    race.applySettings({
      mode: 'words',
      words: 50,
      punctuation: false,
      numbers: true,
      difficulty: 'normal'
    })
    expect(configState.mode).toBe('words')
    expect(configState.words).toBe(50)
    expect(configState.numbers).toBe(true)
    expect(configState.punctuation).toBe(false)

    race.exit()
    expect(race.racing).toBe(false)
    const after = Object.fromEntries(RACE_SNAPSHOT_KEYS.map((key) => [key, configState[key]]))
    expect(after).toEqual(own)
    expect(race.snapshot).toBeNull()
  })

  it('keeps the FIRST snapshot when settings are applied twice (a restart must not re-snapshot the race)', () => {
    setConfig('mode', 'time')
    setConfig('time', 30)
    const race = useRaceStore()
    race.request('run-1')
    race.applySettings({ mode: 'words', words: 25 })
    // A second application (e.g. the data re-resolving) must not capture the
    // race's own settings as "the player's".
    race.applySettings({ mode: 'words', words: 25 })
    race.exit()
    expect(configState.mode).toBe('time')
    expect(configState.time).toBe(30)
  })

  it('restoreSnapshot heals a reload that died mid-race', () => {
    setConfig('mode', 'time')
    setConfig('time', 15)
    const race = useRaceStore()
    race.request('run-1')
    race.applySettings({ mode: 'words', words: 100 })

    // Simulate the reload: the race request is gone, the snapshot survived
    // (it is the one persisted field) — the heal restores the player's config.
    race.requestedRunId = null
    race.restoreSnapshot()
    expect(configState.mode).toBe('time')
    expect(configState.time).toBe(15)
  })

  it('restart requests only bump the tick — settings and snapshot stay put', () => {
    const race = useRaceStore()
    race.request('run-1')
    race.applySettings({ mode: 'words', words: 25 })
    const before = race.snapshot
    race.requestRestart()
    race.requestRestart()
    expect(race.restartTick).toBe(2)
    expect(race.snapshot).toBe(before)
    expect(race.racing).toBe(true)
  })
})
