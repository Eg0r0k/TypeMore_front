<template>
  <figure ref="root" class="pf-hist" data-testid="profile-histogram">
    <div v-if="buckets.length === 0" class="pf-hist__empty" data-testid="profile-histogram-empty">
      <Typography size="s" color="sub">{{ t('profile.charts.empty') }}</Typography>
    </div>

    <svg
      v-else
      class="pf-hist__svg"
      :width="width"
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="t('profile.charts.histogramAria')"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
    >
      <g class="pf-hist__grid">
        <line
          v-for="tick in yTicks"
          :key="tick.value"
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>
      <g class="pf-hist__axis">
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          :x="PAD.left - 8"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ tick.value }}
        </text>
        <text
          v-for="bar in bars"
          :key="`x-${bar.wpm}`"
          :x="bar.x + bar.width / 2"
          :y="HEIGHT - PAD.bottom + 16"
          text-anchor="middle"
        >
          {{ bar.wpm }}
        </text>
      </g>

      <g>
        <rect
          v-for="(bar, index) in bars"
          :key="bar.wpm"
          class="pf-hist__bar"
          :class="{ 'pf-hist__bar--hover': hovered === index }"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          rx="2"
        />
      </g>
    </svg>

    <div
      v-if="hoveredBar"
      class="pf-hist__tooltip"
      :style="{ left: `${hoveredBar.x + hoveredBar.width / 2}px`, top: `${PAD.top}px` }"
    >
      <span class="pf-hist__tooltip-title">{{ hoveredBar.wpm }}–{{ hoveredBar.wpm + 10 }} wpm</span>
      <span>{{ t('profile.charts.tests', { tests: hoveredBar.tests }, hoveredBar.tests) }}</span>
    </div>
  </figure>
</template>

<script setup lang="ts">
  import { computed, ref, useTemplateRef } from 'vue'
  import { useElementSize } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'

  import type { ProfileHistogram } from '@shared/api'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Tests per 10-wpm bucket, as SVG bars in the results chart's idiom (see
   * wpm-chart.vue): CSS-variable colours so a theme switch repaints with zero
   * JS, element-size driven width, nearest-bar hover tooltip. Empty buckets
   * between populated ones render at zero height so the x-axis stays honest.
   */
  const props = defineProps<{ histogram: ProfileHistogram }>()
  const { t } = useI18n()

  const HEIGHT = 200
  const PAD = { top: 12, right: 8, bottom: 30, left: 40 } as const
  const FALLBACK_WIDTH = 640

  const root = useTemplateRef<HTMLElement>('root')
  const { width: measured } = useElementSize(root)
  const width = computed(() => Math.max(320, Math.round(measured.value) || FALLBACK_WIDTH))
  const plotWidth = computed(() => width.value - PAD.left - PAD.right)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom

  /** The full contiguous bucket range, zeros filled in. */
  const buckets = computed(() => {
    const raw = props.histogram.buckets
    if (raw.length === 0) return []
    const lo = Math.min(...raw.map((b) => b.wpm))
    const hi = Math.max(...raw.map((b) => b.wpm))
    const byWpm = new Map(raw.map((b) => [b.wpm, b.tests]))
    const out: { wpm: number; tests: number }[] = []
    for (let wpm = lo; wpm <= hi; wpm += 10) out.push({ wpm, tests: byWpm.get(wpm) ?? 0 })
    return out
  })

  const maxTests = computed(() => Math.max(1, ...buckets.value.map((b) => b.tests)))

  const TICK_ROWS = 4
  const yTicks = computed(() => {
    const step = Math.max(1, Math.ceil(maxTests.value / TICK_ROWS))
    const ticks: { value: number; y: number }[] = []
    for (let value = 0; value <= maxTests.value; value += step) {
      ticks.push({ value, y: PAD.top + plotHeight - (value / maxTests.value) * plotHeight })
    }
    return ticks
  })

  const bars = computed(() => {
    const n = buckets.value.length
    if (n === 0) return []
    const slot = plotWidth.value / n
    const barWidth = Math.max(4, slot * 0.7)
    return buckets.value.map((bucket, i) => {
      const height = (bucket.tests / maxTests.value) * plotHeight
      return {
        ...bucket,
        x: PAD.left + i * slot + (slot - barWidth) / 2,
        y: PAD.top + plotHeight - height,
        width: barWidth,
        height
      }
    })
  })

  const hovered = ref<number | null>(null)
  const hoveredBar = computed(() => (hovered.value === null ? null : bars.value[hovered.value]))

  function onPointerMove(event: PointerEvent): void {
    const n = bars.value.length
    if (n === 0) return
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = event.clientX - box.left
    const slot = plotWidth.value / n
    const index = Math.floor((x - PAD.left) / slot)
    hovered.value = index >= 0 && index < n ? index : null
  }
</script>

<style lang="scss" scoped>
  .pf-hist {
    position: relative;
    width: 100%;
    margin: 0;

    &__svg {
      display: block;
      width: 100%;
      overflow: visible;
    }

    &__grid line {
      stroke: var(--sub-color);
      stroke-dasharray: 2 2;
      stroke-width: 1;
      opacity: 0.4;
    }

    &__axis text {
      font-size: 10px;
      fill: var(--sub-color);
    }

    &__bar {
      fill: var(--main-color);
      opacity: 0.85;

      &--hover {
        opacity: 1;
      }
    }

    &__tooltip {
      position: absolute;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 8px;
      font-size: 11px;
      color: var(--text-color);
      pointer-events: none;
      background-color: var(--bg-color);
      border: 1px solid var(--sub-color);
      border-radius: var(--border-radius);
      transform: translate(-50%, 0);
    }

    &__tooltip-title {
      color: var(--sub-color);
    }

    &__empty {
      padding: 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
