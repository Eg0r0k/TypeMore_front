<template>
  <figure ref="root" class="relative m-0 w-full" data-testid="profile-histogram">
    <div
      v-if="buckets.length === 0"
      class="rounded-lg bg-sub-alt px-4 py-3"
      data-testid="profile-histogram-empty"
    >
      <Typography size="s" color="sub">{{ t('profile.charts.empty') }}</Typography>
    </div>

    <svg
      v-else
      class="block w-full touch-pan-y overflow-visible"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="t('profile.charts.histogramAria')"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
    >
      <g class="[&_line]:stroke-sub [&_line]:opacity-40 [&_line]:[stroke-dasharray:2_2]">
        <line
          v-for="tick in yTicks"
          :key="tick.value"
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>
      <g class="fill-sub" :style="{ fontSize: `${fontSize}px` }">
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          :x="pad.left - 6"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ tick.value }}
        </text>
        <text
          v-for="bar in labelledBars"
          :key="`x-${bar.wpm}`"
          :x="bar.x + bar.width / 2"
          :y="height - pad.bottom + 14"
          text-anchor="middle"
        >
          {{ bar.wpm }}
        </text>
      </g>

      <g>
        <rect
          v-for="(bar, index) in bars"
          :key="bar.wpm"
          class="fill-main transition-tm"
          :class="hovered === index ? 'opacity-100' : 'opacity-85'"
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
      class="pointer-events-none absolute z-1 flex -translate-x-1/2 flex-col gap-0.5 rounded border border-sub bg-bg px-2 py-1.5 text-[11px] text-text"
      :style="{ left: `${tooltipX}px`, top: `${pad.top}px` }"
    >
      <span class="text-sub">{{ hoveredBar.wpm }}–{{ hoveredBar.wpm + 10 }} wpm</span>
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
  import { clamp } from '@/shared/lib/helpers/numbers'

  /**
   * Tests per 10-wpm bucket, as SVG bars in the results chart's idiom (see
   * wpm-chart.vue): CSS-variable colours so a theme switch repaints with zero
   * JS, element-size driven geometry, nearest-bar hover tooltip. Empty buckets
   * between populated ones render at zero height so the x-axis stays honest,
   * and on a narrow card the x labels thin out instead of overlapping.
   */
  const props = defineProps<{ histogram: ProfileHistogram }>()
  const { t } = useI18n()

  const FALLBACK_WIDTH = 640

  const root = useTemplateRef<HTMLElement>('root')
  const { width: measured } = useElementSize(root)
  /** The floor is a phone, not a desktop (see daily.vue). */
  const width = computed(() => Math.max(240, Math.round(measured.value) || FALLBACK_WIDTH))

  const compact = computed(() => width.value < 520)
  const height = computed(() => (compact.value ? 150 : 200))
  const fontSize = computed(() => (compact.value ? 9 : 10))
  const pad = computed(() =>
    compact.value
      ? { top: 10, right: 6, bottom: 22, left: 28 }
      : { top: 12, right: 8, bottom: 30, left: 40 }
  )
  const plotWidth = computed(() => width.value - pad.value.left - pad.value.right)
  const plotHeight = computed(() => height.value - pad.value.top - pad.value.bottom)

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
      ticks.push({
        value,
        y: pad.value.top + plotHeight.value - (value / maxTests.value) * plotHeight.value
      })
    }
    return ticks
  })

  const bars = computed(() => {
    const n = buckets.value.length
    if (n === 0) return []
    const slot = plotWidth.value / n
    const barWidth = Math.max(4, slot * 0.7)
    return buckets.value.map((bucket, i) => {
      const barHeight = (bucket.tests / maxTests.value) * plotHeight.value
      return {
        ...bucket,
        x: pad.value.left + i * slot + (slot - barWidth) / 2,
        y: pad.value.top + plotHeight.value - barHeight,
        width: barWidth,
        height: barHeight
      }
    })
  })

  /** Only every n-th bucket gets an x label once the bars get narrow. */
  const labelledBars = computed(() => {
    const slot = plotWidth.value / Math.max(1, bars.value.length)
    const every = Math.max(1, Math.ceil((compact.value ? 26 : 32) / Math.max(1, slot)))
    return bars.value.filter((_, i) => i % every === 0)
  })

  const hovered = ref<number | null>(null)
  const hoveredBar = computed(() => (hovered.value === null ? null : bars.value[hovered.value]))

  /** The tooltip is centred on the bar but never hangs off the figure. */
  const TOOLTIP_HALF = 55
  const tooltipX = computed(() => {
    const bar = hoveredBar.value
    if (!bar) return 0
    return clamp(bar.x + bar.width / 2, TOOLTIP_HALF, width.value - TOOLTIP_HALF)
  })

  function onPointerMove(event: PointerEvent): void {
    const n = bars.value.length
    if (n === 0) return
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = event.clientX - box.left
    const slot = plotWidth.value / n
    const index = Math.floor((x - pad.value.left) / slot)
    hovered.value = index >= 0 && index < n ? index : null
  }
</script>
