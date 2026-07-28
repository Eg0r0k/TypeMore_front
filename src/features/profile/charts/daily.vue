<template>
  <figure ref="root" class="pf-daily" data-testid="profile-daily-chart">
    <div v-if="days.length === 0" class="pf-daily__empty" data-testid="profile-daily-empty">
      <Typography size="s" color="sub">{{ t('profile.charts.empty') }}</Typography>
    </div>

    <svg
      v-else
      class="pf-daily__svg"
      :width="width"
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="t('profile.charts.dailyAria')"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
    >
      <g class="pf-daily__grid">
        <line
          v-for="tick in yTicks"
          :key="tick.value"
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>
      <g class="pf-daily__axis">
        <!-- Left axis: time typing (minutes); right axis: the line metric. -->
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          :x="PAD.left - 8"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ tick.value }}m
        </text>
        <text
          v-for="tick in y1Ticks"
          :key="`y1-${tick.value}`"
          :x="width - PAD.right + 8"
          :y="tick.y"
          text-anchor="start"
          dominant-baseline="middle"
        >
          {{ tick.value }}
        </text>
        <text
          v-for="tick in xTicks"
          :key="tick.date"
          :x="tick.x"
          :y="HEIGHT - PAD.bottom + 16"
          text-anchor="middle"
        >
          {{ tick.label }}
        </text>
      </g>

      <!-- Bars: time typing per day. -->
      <g>
        <rect
          v-for="(bar, index) in bars"
          :key="bar.date"
          class="pf-daily__bar"
          :class="{ 'pf-daily__bar--hover': hovered === index }"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          rx="1.5"
        />
      </g>

      <!-- The smoothed metric line + its dotted OLS trend. -->
      <path class="pf-daily__trend" :d="trendPath" />
      <path class="pf-daily__line" :d="linePath" />

      <g v-if="hoveredDay" class="pf-daily__cursor">
        <line :x1="hoveredDay.x" :x2="hoveredDay.x" :y1="PAD.top" :y2="HEIGHT - PAD.bottom" />
      </g>
    </svg>

    <div
      v-if="hoveredDay"
      class="pf-daily__tooltip"
      :style="{ left: `${hoveredDay.x}px`, top: `${PAD.top}px` }"
    >
      <span class="pf-daily__tooltip-title">{{ hoveredDay.date }}</span>
      <span>{{ t('profile.charts.time') }} {{ formatDuration(hoveredDay.timeTypingMs) }}</span>
      <span>
        {{ metric === 'speed' ? 'wpm' : 'acc' }}
        {{ metric === 'speed' ? speed(hoveredDay.value) : percent(hoveredDay.value) }}
      </span>
    </div>

    <figcaption class="pf-daily__legend">
      <span>
        <i class="pf-daily__swatch pf-daily__swatch--bar" />
        {{ t('profile.charts.time') }}
      </span>
      <span>
        <i class="pf-daily__swatch pf-daily__swatch--line" />
        {{ metric === 'speed' ? t('profile.charts.avgWpm') : t('profile.charts.avgAcc') }}
      </span>
      <span>
        <i class="pf-daily__swatch pf-daily__swatch--trend" />
        {{ t('profile.charts.trend') }}
      </span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
  import { computed, ref, useTemplateRef } from 'vue'
  import { useElementSize } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'

  import type { ProfileTimeseries } from '@shared/api'
  import { Typography } from '@/shared/ui/typography'
  import { formatDuration, percent, speed } from '../model/format'

  /**
   * The daily activity chart (results-chart idiom — see wpm-chart.vue): bars
   * are time typed per day on the left axis; the overlaid line is the day's
   * average speed or accuracy (the metric toggle), smoothed by a trailing
   * moving average over the toggle's window; the dotted line is the OLS trend
   * of the RAW daily values across the visible range. The
   * "speed change per hour" header stat is server-computed and rendered by the
   * section header, not here — this figure only draws the range it was given.
   */
  const props = defineProps<{
    timeseries: ProfileTimeseries
    metric: 'speed' | 'accuracy'
    /** Moving-average window for the line: avg of 10 | avg of 100. */
    smoothing: number
  }>()
  const { t } = useI18n()

  const HEIGHT = 240
  const PAD = { top: 16, right: 44, bottom: 30, left: 44 } as const
  const FALLBACK_WIDTH = 640

  const root = useTemplateRef<HTMLElement>('root')
  const { width: measured } = useElementSize(root)
  const width = computed(() => Math.max(320, Math.round(measured.value) || FALLBACK_WIDTH))
  const plotWidth = computed(() => width.value - PAD.left - PAD.right)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom

  const days = computed(() => props.timeseries.days)
  const count = computed(() => days.value.length)

  const valueOf = (day: ProfileTimeseries['days'][number]): number =>
    props.metric === 'speed' ? day.avgWpm : day.avgAcc

  const xAt = (index: number): number =>
    count.value < 2
      ? PAD.left + plotWidth.value / 2
      : PAD.left + (index / (count.value - 1)) * plotWidth.value

  // Left axis: minutes typed.
  const maxMinutes = computed(() =>
    Math.max(1, ...days.value.map((d) => Math.ceil(d.timeTypingMs / 60000)))
  )
  const yTicks = computed(() => {
    const step = Math.max(1, Math.ceil(maxMinutes.value / 4))
    const ticks: { value: number; y: number }[] = []
    for (let value = 0; value <= maxMinutes.value; value += step) {
      ticks.push({ value, y: PAD.top + plotHeight - (value / maxMinutes.value) * plotHeight })
    }
    return ticks
  })

  // Right axis: the metric.
  const metricMax = computed(() =>
    props.metric === 'accuracy' ? 1 : Math.max(20, ...days.value.map((d) => d.avgWpm))
  )
  const y1Of = (value: number): number =>
    PAD.top + plotHeight - (Math.min(value, metricMax.value) / metricMax.value) * plotHeight
  const y1Ticks = computed(() =>
    Array.from({ length: 5 }, (_, i) => {
      const value = (metricMax.value / 4) * i
      return {
        value: props.metric === 'accuracy' ? Math.round(value * 100) : Math.round(value),
        y: y1Of(value)
      }
    })
  )

  const xTicks = computed(() => {
    const every = Math.max(1, Math.ceil(count.value / 8))
    return days.value
      .map((day, index) => ({ date: day.date, label: day.date.slice(5), x: xAt(index), index }))
      .filter((tick) => tick.index % every === 0 || tick.index === count.value - 1)
  })

  const bars = computed(() => {
    const n = count.value
    if (n === 0) return []
    const slot = plotWidth.value / n
    const barWidth = Math.max(2, Math.min(18, slot * 0.7))
    return days.value.map((day, i) => {
      const minutes = day.timeTypingMs / 60000
      const height = Math.min(1, minutes / maxMinutes.value) * plotHeight
      return {
        date: day.date,
        x: xAt(i) - barWidth / 2,
        y: PAD.top + plotHeight - height,
        width: barWidth,
        height
      }
    })
  })

  /** Trailing moving average over the smoothing window (avg of 10 / 100). */
  const smoothed = computed(() => {
    const values = days.value.map(valueOf)
    const window = Math.max(1, props.smoothing)
    const out: number[] = []
    let sum = 0
    for (let i = 0; i < values.length; i++) {
      sum += values[i]
      if (i >= window) sum -= values[i - window]
      out.push(sum / Math.min(i + 1, window))
    }
    return out
  })

  const linePath = computed(() => {
    const values = smoothed.value
    if (values.length === 0) return ''
    return values
      .map((value, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${y1Of(value).toFixed(2)}`)
      .join(' ')
  })

  /** OLS over the raw daily values: the dotted trend the toggle never changes. */
  const trendPath = computed(() => {
    const values = days.value.map(valueOf)
    const n = values.length
    if (n < 2) return ''
    const meanX = (n - 1) / 2
    const meanY = values.reduce((sum, v) => sum + v, 0) / n
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (values[i] - meanY)
      den += (i - meanX) ** 2
    }
    const slope = den === 0 ? 0 : num / den
    const at = (i: number): number => meanY + slope * (i - meanX)
    return `M ${xAt(0).toFixed(2)} ${y1Of(at(0)).toFixed(2)} L ${xAt(n - 1).toFixed(2)} ${y1Of(at(n - 1)).toFixed(2)}`
  })

  const hovered = ref<number | null>(null)
  const hoveredDay = computed(() => {
    if (hovered.value === null) return null
    const day = days.value[hovered.value]
    if (!day) return null
    return { ...day, value: valueOf(day), x: xAt(hovered.value) }
  })

  function onPointerMove(event: PointerEvent): void {
    if (count.value === 0) return
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = event.clientX - box.left
    const ratio = (x - PAD.left) / (plotWidth.value || 1)
    const index = Math.round(ratio * Math.max(1, count.value - 1))
    hovered.value = Math.min(count.value - 1, Math.max(0, index))
  }
</script>

<style lang="scss" scoped>
  .pf-daily {
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
      fill: var(--sub-color);
      opacity: 0.55;

      &--hover {
        opacity: 0.9;
      }
    }

    &__line {
      fill: none;
      stroke: var(--main-color);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    &__trend {
      fill: none;
      stroke: var(--text-color);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
      opacity: 0.6;
    }

    &__cursor line {
      stroke: var(--sub-color);
      stroke-width: 1;
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

    &__legend {
      display: flex;
      gap: 12px;
      justify-content: center;
      font-size: 11px;
      color: var(--text-color);
    }

    &__swatch {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 4px;
      border-radius: 50%;

      &--bar {
        background-color: var(--sub-color);
      }

      &--line {
        background-color: var(--main-color);
      }

      &--trend {
        background-color: var(--text-color);
        opacity: 0.6;
      }
    }

    &__empty {
      padding: 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
