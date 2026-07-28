<template>
  <aside v-if="rows.length > 1" class="race-rail" data-testid="race-rail" aria-hidden="true">
    <TransitionGroup tag="ol" name="race" class="race-rail__list">
      <li
        v-for="(row, index) in rows"
        :key="row.playerId"
        class="race-rail__row"
        :class="{ 'race-rail__row--you': row.you, 'race-rail__row--out': row.out }"
        :data-testid="`race-row-${row.playerId}`"
      >
        <span class="race-rail__rank">{{ index + 1 }}</span>
        <span class="race-rail__nick">{{ row.nick }}</span>
        <span class="race-rail__combo">
          ×{{ row.combo }}
          <span
            v-for="cross in crossesFor(row.playerId)"
            :key="cross.key"
            class="race-rail__cross"
            data-testid="streak-cross"
            @animationend="removeCross(cross.key)"
          >
            ✕
          </span>
        </span>
        <span class="race-rail__points">{{ Math.round(row.points) }}</span>
      </li>
    </TransitionGroup>
  </aside>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useMatchSessionStore } from '@/entities/match'

  /**
   * Live race standings beside the field: every seat (self included) ranked by
   * live points — the ghost fold's combo base × that seat's frozen mod
   * multiplier, i.e. the running approximation of the scoreV2 total the final
   * standings will sort by (minus the finalize-only acc²/time factors, which do
   * not exist mid-run). Reorders animate via the TransitionGroup FLIP move
   * class; a broken streak spawns a small ✕ that floats up and evaporates over
   * the player who dropped it.
   *
   * Rendered only when there is someone to race (a lone seat is not a race),
   * and marked aria-hidden like the ScoreHud: it repeats information available
   * elsewhere at a per-keystroke churn no screen reader should be fed.
   */
  interface RaceRow {
    readonly playerId: string
    readonly nick: string
    readonly you: boolean
    readonly points: number
    readonly combo: number
    /** Out of the race (left/dnf/desynced/eliminated) — dimmed, keeps its last points. */
    readonly out: boolean
  }

  const session = useMatchSessionStore()

  const rows = computed<RaceRow[]>(() => {
    const hud = session.selfHud
    const selfId = session.selfId ?? 'self'
    const you: RaceRow = {
      playerId: selfId,
      nick: session.room?.players.find((p) => p.playerId === selfId)?.nick ?? 'you',
      you: true,
      points: hud.score * hud.modMultiplier,
      combo: hud.combo,
      out: false
    }
    const others: RaceRow[] = session.peers.map((peer) => ({
      playerId: peer.playerId,
      nick: peer.nick,
      you: false,
      points: peer.points,
      combo: peer.combo,
      out: peer.status !== 'racing' && peer.status !== 'finished'
    }))
    // Points first; the id tiebreak keeps equal rows from swapping every tick.
    return [you, ...others].sort(
      (a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId)
    )
  })

  // ── streak-break crosses ──────────────────────────────────────────────────
  /**
   * A break is a streak that RESET, not one that merely grew slower: previous
   * combo at least this high, current combo zero. The floor keeps the rail from
   * flashing on every stray typo at combo 1–2, where nothing was really lost.
   */
  const CROSS_MIN_STREAK = 5

  interface Cross {
    readonly key: number
    readonly playerId: string
  }

  const crosses = ref<Cross[]>([])
  let crossKey = 0
  const prevCombos = new Map<string, number>()

  // `immediate` seeds the previous-combo map from the FIRST render: without it
  // a streak standing at mount would read as 0 and its break would pass silent.
  watch(
    rows,
    (next) => {
      for (const row of next) {
        const prev = prevCombos.get(row.playerId) ?? 0
        if (row.combo === 0 && prev >= CROSS_MIN_STREAK) {
          crosses.value = [...crosses.value, { key: ++crossKey, playerId: row.playerId }]
        }
        prevCombos.set(row.playerId, row.combo)
      }
    },
    { immediate: true }
  )

  const crossesFor = (playerId: string): Cross[] =>
    crosses.value.filter((cross) => cross.playerId === playerId)

  /** The ✕ removes itself when its rise-and-fade animation ends. */
  const removeCross = (key: number): void => {
    crosses.value = crosses.value.filter((cross) => cross.key !== key)
  }
</script>

<style lang="scss" scoped>
  .race-rail {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    user-select: none;

    &__list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__row {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      color: var(--sub-color);

      &--you {
        color: var(--text-color);
      }

      &--out {
        opacity: 0.45;
      }
    }

    &__rank {
      width: 1rem;
      text-align: right;
    }

    &__nick {
      max-width: 7rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__combo {
      position: relative;
      margin-left: auto;
      font-size: 0.7rem;
    }

    &__points {
      min-width: 3rem;
      text-align: right;
    }

    // The evaporating ✕ of a broken streak: rises and fades over the combo it
    // used to be. Pure CSS; `animationend` removes the node.
    &__cross {
      position: absolute;
      bottom: 0.2rem;
      left: 50%;
      color: var(--error-color);
      pointer-events: none;
      animation: race-cross-evaporate 0.7s ease-out forwards;
    }
  }

  // FLIP move for position swaps — vue's TransitionGroup stamps `race-move`.
  .race-move {
    transition: transform 0.4s ease;
  }

  @keyframes race-cross-evaporate {
    from {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    to {
      opacity: 0;
      transform: translate(-50%, -14px);
    }
  }
</style>
