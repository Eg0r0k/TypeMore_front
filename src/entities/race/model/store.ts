import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { configState, setConfig } from '@/shared/lib/helpers/config'
import type { Config } from '@/shared/constants/type'

/**
 * The race state of the HOME solo screen (the race-vs-run rework): pressing a
 * "race" action anywhere — a board row, a profile PB card, a runs-table row —
 * does not navigate to a game page. It routes through `/race/{runId}` (kept as
 * a thin redirect so deep links survive), which calls {@link request} and lands
 * on home; the home page fetches the run, applies its stored setup wholesale
 * and seats the ghost. This store owns the two facts that must outlive that
 * flow:
 *
 * - `requestedRunId` — which run the solo screen should be racing;
 * - `snapshot` — the player's OWN core-bound settings from before the race,
 *   restored EXACTLY on exit. The snapshot (alone) is persisted: a reload
 *   mid-race kills the race but not localStorage, and without the heal the
 *   race's settings would silently become the player's saved ones.
 */

/**
 * The core-bound fields a race overwrites and must restore. View-only mods
 * (blind/fading/flashlight) are deliberately absent: the racer types under
 * their own view, the ghost replays under its own declaration. `language` is
 * absent too — the race's words are fixed by the run itself and never
 * regenerated, and the run carries a BCP-47 tag, not a dictionary key, so
 * writing it into the config would corrupt a real setting for a fake display.
 */
export const RACE_SNAPSHOT_KEYS = [
  'mode',
  'time',
  'words',
  'quoteGroup',
  'punctuation',
  'numbers',
  'randomCase',
  'reverse',
  'nospace',
  'difficulty',
  'minWpm',
  'freedomMode',
  'stopOnError',
  'quickEnd'
] as const
export type RaceSnapshotKey = (typeof RACE_SNAPSHOT_KEYS)[number]
export type RaceConfigSnapshot = Pick<Config, RaceSnapshotKey>

const pickSnapshot = (): RaceConfigSnapshot => {
  const out = {} as Record<RaceSnapshotKey, Config[RaceSnapshotKey]>
  for (const key of RACE_SNAPSHOT_KEYS) out[key] = configState[key]
  return out as RaceConfigSnapshot
}

export const useRaceStore = defineStore(
  'race-state',
  () => {
    const requestedRunId = ref<string | null>(null)
    const snapshot = ref<RaceConfigSnapshot | null>(null)
    /** Bumped to ask the live race to re-run the same ghost from 3-2-1. */
    const restartTick = ref(0)

    const racing = computed(() => requestedRunId.value !== null)

    /** Arm the race (the /race/{id} redirect's one job). */
    function request(runId: string): void {
      requestedRunId.value = runId
    }

    /**
     * Overwrite the config with the run's core-bound settings, snapshotting
     * the player's own first. Writes go through `setConfig` — the same
     * validated gate every settings surface uses.
     */
    function applySettings(settings: Partial<RaceConfigSnapshot>): void {
      if (snapshot.value === null) snapshot.value = pickSnapshot()
      for (const key of RACE_SNAPSHOT_KEYS) {
        const value = settings[key]
        if (value !== undefined) setConfig(key, value)
      }
    }

    function requestRestart(): void {
      restartTick.value += 1
    }

    /** Restore the snapshot verbatim; the exit path and the reload heal share it. */
    function restoreSnapshot(): void {
      const snap = snapshot.value
      if (snap === null) return
      snapshot.value = null
      for (const key of RACE_SNAPSHOT_KEYS) setConfig(key, snap[key])
    }

    /** Leave the race: the player's own settings come back exactly. */
    function exit(): void {
      requestedRunId.value = null
      restoreSnapshot()
    }

    return {
      requestedRunId,
      snapshot,
      restartTick,
      racing,
      request,
      applySettings,
      requestRestart,
      restoreSnapshot,
      exit
    }
  },
  {
    persist: {
      storage: localStorage,
      key: 'race-state',
      // Only the snapshot: a race itself dies with the tab, but the settings
      // it displaced must not.
      pick: ['snapshot'],
      afterHydrate: (ctx) => {
        // Reload heal: a persisted snapshot with no live race means a reload
        // killed a race mid-flight AFTER the run's settings were written into
        // the persisted config. Put the player's own settings back.
        const store = ctx.store as ReturnType<typeof useRaceStore>
        if (store.snapshot !== null && store.requestedRunId === null) {
          store.restoreSnapshot()
        }
      }
    }
  }
)
