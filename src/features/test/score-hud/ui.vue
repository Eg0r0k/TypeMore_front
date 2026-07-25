<template>
  <div class="score-hud" :style="{ '--combo-lift': lift }" aria-hidden="true">
    <span v-if="displayModMultiplier" class="score-hud__mod">
      &times;{{ displayModMultiplier }}
    </span>
    <span class="score-hud__score">{{ displayScore }}</span>
    <span ref="comboRef" class="score-hud__combo">{{ combo }} &times;{{ displayMultiplier }}</span>
    <span class="score-hud__speed">{{ displayWpm }} wpm · {{ displayRaw }} raw</span>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'

  /**
   * osu-style live scoring HUD — sibling chrome for the game field (like the
   * settings bar), OUTSIDE the shadow root and field internals. A pure view:
   * every value is a prop the game store already computes from the log. Hidden
   * entirely in blind mode by its host (combo leaks per-keystroke correctness).
   *
   * Design (docs/design-system.md): monospace, tabular numerals so a fixed slot
   * never shifts the field. Idle = sub-color; the whole HUD lifts toward
   * main-color as the multiplier grows (color-mix on the two theme tokens). The
   * only motion is a subtle 0.08s scale pulse on a combo increment; a combo
   * break is an instant drop back to sub-color — no shake, no flash.
   */
  const props = defineProps<{
    /** Live combo points (unrounded); displayed rounded. */
    score: number
    /** Current scoring streak. */
    combo: number
    /** Active combo multiplier (1.0 – 2.5). */
    multiplier: number
    /** Combined mod multiplier (scoreV2), fixed for the run; chip shown when > 1. */
    modMultiplier: number
    /** Live net WPM. */
    wpm: number
    /** Live raw WPM. */
    raw: number
  }>()

  const comboRef = ref<HTMLElement | null>(null)

  const displayScore = computed(() => Math.round(props.score))
  const displayMultiplier = computed(() => props.multiplier.toFixed(2))
  // 0 at ×1.0 → 100 at the ×2.5 cap; drives the sub→main color lift.
  const lift = computed(() => Math.min(100, Math.max(0, ((props.multiplier - 1) / 1.5) * 100)))
  const displayWpm = computed(() => Math.round(props.wpm))
  const displayRaw = computed(() => Math.round(props.raw))
  // Static chip: the run's mod multiplier, shown only when it actually boosts the score.
  const displayModMultiplier = computed(() =>
    props.modMultiplier > 1 ? props.modMultiplier.toFixed(2) : null
  )

  // Scale pulse on a combo increment only. Web Animations API keeps it a
  // composited transform (no layout thrash on the field) and retriggers cleanly
  // on rapid keystrokes. A reset (combo → 0) never pulses.
  watch(
    () => props.combo,
    (next, prev) => {
      if (next <= prev) return
      comboRef.value?.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], {
        duration: 80,
        easing: 'linear'
      })
    }
  )
</script>

<style lang="scss" scoped>
  .score-hud {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: color-mix(in srgb, var(--sub-color), var(--main-color) calc(var(--combo-lift, 0) * 1%));
    user-select: none;

    &__score {
      font-size: 32px;
    }

    &__combo {
      font-size: 16px;
      transform-origin: center;
      will-change: transform;
    }

    &__mod {
      align-self: center;
      padding: 1px 8px;
      font-size: 14px;
      color: var(--main-color);
      background: var(--sub-alt-color);
      border: 1px solid var(--sub-color);
      border-radius: var(--border-radius, 6px);
    }

    &__speed {
      font-size: 13px;
      color: var(--sub-color);
    }
  }
</style>
