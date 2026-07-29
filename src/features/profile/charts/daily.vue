<template>
  <figure ref="root" class="relative m-0 w-full" data-testid="profile-daily-chart">
    <div
      v-if="days.length === 0"
      class="rounded-lg bg-sub-alt px-4 py-3"
      data-testid="profile-daily-empty"
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
      :aria-label="t('profile.charts.dailyAria')"
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
        <!-- Left axis: time typing (minutes); right axis: the line metric. -->
        <text
          v-for="tick in yTicks"
          :key="`y-${tick.value}`"
          :x="pad.left - 6"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ tick.value }}m
        </text>
        <text
          v-for="tick in y1Ticks"
          :key="`y1-${tick.value}`"
          :x="width - pad.right + 6"
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
          :y="height - pad.bottom + 14"
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
          class="fill-sub transition-tm"
          :class="hovered === index ? 'opacity-90' : 'opacity-55'"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          rx="1.5"
        />
      </g>

      <!-- The smoothed metric line + its dotted OLS trend. -->
      <path
        class="fill-none stroke-text opacity-60 [stroke-dasharray:4_4] [stroke-width:1.5]"
        :d="trendPath"
        data-testid="profile-daily-trend"
      />
      <path
        class="fill-none stroke-main [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]"
        :d="linePath"
        data-testid="profile-daily-line"
      />

      <g v-if="hoveredDay">
        <line
          class="stroke-sub [stroke-width:1]"
          :x1="hoveredDay.x"
          :x2="hoveredDay.x"
          :y1="pad.top"
          :y2="height - pad.bottom"
        />
      </g>
    </svg>

    <div
      v-if="hoveredDay"
      class="pointer-events-none absolute z-1 flex -translate-x-1/2 flex-col gap-0.5 rounded border border-sub bg-bg px-2 py-1.5 text-[11px] text-text"
      :style="{ left: `${tooltipX}px`, top: `${pad.top}px` }"
    >
      <span class="text-sub">{{ hoveredDay.date }}</span>
      <span>{{ t('profile.charts.time') }} {{ formatDuration(hoveredDay.timeTypingMs) }}</span>
      <span>
        {{ metric === 'speed' ? 'wpm' : 'acc' }}
        {{ metric === 'speed' ? speed(hoveredDay.value) : percent(hoveredDay.value) }}
      </span>
    </div>

    <figcaption class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-text">
      <span class="inline-flex items-center gap-1">
        <i class="inline-block size-2 rounded-full bg-sub" />
        {{ t('profile.charts.time') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <i class="inline-block size-2 rounded-full bg-main" />
        {{ metric === 'speed' ? t('profile.charts.avgWpm') : t('profile.charts.avgAcc') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <i class="inline-block size-2 rounded-full bg-text opacity-60" />
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
  import { clamp } from '@/shared/lib/helpers/numbers'
  import { formatDuration, percent, speed } from '../model/format'

  /**
   * The daily activity chart (results-chart idiom — see wpm-chart.vue): bars
   * are time typed per day on the left axis; the overlaid line is the day's
   * average speed or accuracy (the metric toggle), smoothed by a trailing
   * moving average over the toggle's window; the dotted line is the OLS trend
   * of the RAW daily values across the visible range. The
   * "speed change per hour" header stat is server-computed and rendered by the
   * section header, not here — this figure only draws the range it was given.
   *
   * Every dimension (height, padding, tick density, label size) is derived from
   * the MEASURED width, so the same figure reads on a 360 px phone and on a
   * wide desktop card without a second layout.
   */
  const props = defineProps<{
    timeseries: ProfileTimeseries
    metric: 'speed' | 'accuracy'
    /** Moving-average window for the line: avg of 10 | avg of 100. */
    smoothing: number
  }>()
  const { t } = useI18n()

  const FALLBACK_WIDTH = 640

  const root = useTemplateRef<HTMLElement>('root')
  const { width: measured } = useElementSize(root)
  /** The floor is a phone, not a desktop: 240 px is drawn honestly, below that
   *  the viewBox scales the whole figure down rather than clipping it. */
  const width = computed(() => Math.max(240, Math.round(measured.value) || FALLBACK_WIDTH))

  /** Narrow cards get a shorter box, tighter gutters and smaller labels. */
  const compact = computed(() => width.value < 520)
  const height = computed(() => (compact.value ? 180 : width.value < 760 ? 210 : 240))
  const fontSize = computed(() => (compact.value ? 9 : 10))
  const pad = computed(() =>
    compact.value
      ? { top: 10, right: 30, bottom: 22, left: 30 }
      : { top: 16, right: 44, bottom: 30, left: 44 }
  )
  const plotWidth = computed(() => width.value - pad.value.left - pad.value.right)
  const plotHeight = computed(() => height.value - pad.value.top - pad.value.bottom)

  const days = computed(() => props.timeseries.days)
  const count = computed(() => days.value.length)

  const valueOf = (day: ProfileTimeseries['days'][number]): number =>
    props.metric === 'speed' ? day.avgWpm : day.avgAcc

  const xAt = (index: number): number =>
    count.value < 2
      ? pad.value.left + plotWidth.value / 2
      : pad.value.left + (index / (count.value - 1)) * plotWidth.value

  // Left axis: minutes typed.
  const maxMinutes = computed(() =>
    Math.max(1, ...days.value.map((d) => Math.ceil(d.timeTypingMs / 60000)))
  )
  const TICK_ROWS = 4
  const yTicks = computed(() => {
    const step = Math.max(1, Math.ceil(maxMinutes.value / TICK_ROWS))
    const ticks: { value: number; y: number }[] = []
    for (let value = 0; value <= maxMinutes.value; value += step) {
      ticks.push({
        value,
        y: pad.value.top + plotHeight.value - (value / maxMinutes.value) * plotHeight.value
      })
    }
    return ticks
  })

  // Right axis: the metric.
  const metricMax = computed(() =>
    props.metric === 'accuracy' ? 1 : Math.max(20, ...days.value.map((d) => d.avgWpm))
  )
  const y1Of = (value: number): number =>
    pad.value.top +
    plotHeight.value -
    (Math.min(value, metricMax.value) / metricMax.value) * plotHeight.value
  const y1Ticks = computed(() =>
    Array.from({ length: TICK_ROWS + 1 }, (_, i) => {
      const value = (metricMax.value / TICK_ROWS) * i
      return {
        value: props.metric === 'accuracy' ? Math.round(value * 100) : Math.round(value),
        y: y1Of(value)
      }
    })
  )

  /** As many date labels as fit without colliding — roughly one per 80 px. */
  const xTicks = computed(() => {
    const slots = Math.max(2, Math.floor(plotWidth.value / (compact.value ? 60 : 80)))
    const every = Math.max(1, Math.ceil(count.value / slots))
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
      const barHeight = Math.min(1, minutes / maxMinutes.value) * plotHeight.value
      return {
        date: day.date,
        x: xAt(i) - barWidth / 2,
        y: pad.value.top + plotHeight.value - barHeight,
        width: barWidth,
        height: barHeight
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

  /** The tooltip is centred on the cursor but never hangs off the figure. */
  const TOOLTIP_HALF = 60
  const tooltipX = computed(() => {
    const x = hoveredDay.value?.x ?? 0
    return clamp(x, TOOLTIP_HALF, width.value - TOOLTIP_HALF)
  })

  function onPointerMove(event: PointerEvent): void {
    if (count.value === 0) return
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = event.clientX - box.left
    const ratio = (x - pad.value.left) / (plotWidth.value || 1)
    const index = Math.round(ratio * Math.max(1, count.value - 1))
    hovered.value = Math.min(count.value - 1, Math.max(0, index))
  }
</script>
