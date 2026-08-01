import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

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
  'lazy',
  'nospace',
  'difficulty',
  'minWpm',
  'freedomMode',
  'stopOnError',
  'quickEnd'
] as const
export type RaceSnapshotKey = (typeof RACE_SNAPSHOT_KEYS)[number]
export type RaceConfigSnapshot = Pick<Config, RaceSnapshotKey>

/**
 * The ghost's live caret inside the HOME field — the race's one "ghost car",
 * shaped like a multiplayer peer's caret anchor (target positions, never the
 * raw typed string). Runtime-only: the host publishes it each dispatched ghost
 * event, the home page maps it onto the field's `ghosts` prop, and persistence
 * never sees it.
 */
export interface RaceGhostCaret {
  label: string
  wordIndex: number
  charIndex: number
}

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
    /** Bumped to ask the live race to re-seat the same ghost from the start line. */
    const restartTick = ref(0)
    /** The ghost's caret in the home field; null while no ghost is on track. */
    const ghostCaret = shallowRef<RaceGhostCaret | null>(null)
    /** The record owner's nick — what the pace selector names the ghost mode after. */
    const ghostName = ref<string | null>(null)
    /**
     * Set ONLY when the player crossed the line SLOWER than the record —
     * the results screen's "lost to the bot" line. A win renders nothing.
     */
    const defeat = shallowRef<{ you: number; them: number } | null>(null)

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

    /** Publish (or hide, with null) the ghost's caret for the home field. */
    function setGhostCaret(caret: RaceGhostCaret | null): void {
      ghostCaret.value = caret
    }

    function setGhostName(name: string | null): void {
      ghostName.value = name
    }

    function setDefeat(value: { you: number; them: number } | null): void {
      defeat.value = value
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
      ghostCaret.value = null
      ghostName.value = null
      defeat.value = null
      restoreSnapshot()
    }

    return {
      requestedRunId,
      snapshot,
      restartTick,
      ghostCaret,
      ghostName,
      defeat,
      racing,
      request,
      applySettings,
      requestRestart,
      setGhostCaret,
      setGhostName,
      setDefeat,
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
