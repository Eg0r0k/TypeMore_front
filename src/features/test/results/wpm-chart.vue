<template>
  <figure ref="root" class="wpm-chart">
    <svg
      class="wpm-chart__svg"
      :width="width"
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="ariaLabel"
      @pointermove="onPointerMove"
      @pointerleave="hovered = null"
    >
      <!-- horizontal grid + wpm axis -->
      <g class="wpm-chart__grid">
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick.value}`"
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>
      <g class="wpm-chart__axis">
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
          :key="`x-${tick.second}`"
          :x="tick.x"
          :y="HEIGHT - PAD.bottom + 16"
          text-anchor="middle"
        >
          {{ tick.second }}
        </text>
      </g>
      <g class="wpm-chart__axis wpm-chart__axis--title">
        <text :x="(PAD.left + width - PAD.right) / 2" :y="HEIGHT - 2" text-anchor="middle">
          seconds
        </text>
        <text :transform="`translate(10 ${plotMiddle}) rotate(-90)`" text-anchor="middle">
          words per minute
        </text>
        <text :transform="`translate(${width - 4} ${plotMiddle}) rotate(-90)`" text-anchor="middle">
          errors
        </text>
      </g>

      <!--
        `raw` is the INSTANTANEOUS series — how fast each single second was — so
        filling it down to the axis turns it into the run's own terrain. It is
        also what makes the `wpm` line legible: a 2px accent line reads far
        better over a soft mass than over an empty grid, and that line is what
        this screen is opened for. The fill is the raw series' own colour, so
        nothing here is coloured as something it is not.
      -->
      <path v-if="rawArea" class="wpm-chart__area wpm-chart__area--raw" :d="rawArea" />

      <!-- series -->
      <path class="wpm-chart__line wpm-chart__line--raw" :d="rawPath" />
      <path class="wpm-chart__line wpm-chart__line--wpm" :d="wpmPath" />
      <g class="wpm-chart__errors">
        <g v-for="mark in errorMarks" :key="`err-${mark.second}`" :transform="mark.transform">
          <line x1="-4" y1="-4" x2="4" y2="4" />
          <line x1="-4" y1="4" x2="4" y2="-4" />
        </g>
      </g>

      <!-- Where the cumulative line settled: the run's own average, and the
           number the summary reports. -->
      <g v-if="average" class="wpm-chart__average">
        <line :x1="PAD.left" :x2="width - PAD.right" :y1="average.y" :y2="average.y" />
        <text :x="PAD.left + 4" :y="average.y - 5">avg {{ average.value }}</text>
      </g>

      <!-- hover crosshair -->
      <g v-if="hoveredPoint" class="wpm-chart__cursor">
        <line :x1="hoveredPoint.x" :x2="hoveredPoint.x" :y1="PAD.top" :y2="HEIGHT - PAD.bottom" />
        <circle class="wpm-chart__dot--wpm" :cx="hoveredPoint.x" :cy="hoveredPoint.wpmY" r="3" />
        <circle class="wpm-chart__dot--raw" :cx="hoveredPoint.x" :cy="hoveredPoint.rawY" r="3" />
      </g>
    </svg>

    <div
      v-if="hoveredPoint"
      class="wpm-chart__tooltip"
      :style="{ left: `${hoveredPoint.x}px`, top: `${PAD.top}px` }"
    >
      <span class="wpm-chart__tooltip-title">{{ hoveredPoint.second }}s</span>
      <span>
        <i class="wpm-chart__swatch wpm-chart__swatch--wpm" />
        wpm {{ hoveredPoint.wpm }}
      </span>
      <span>
        <i class="wpm-chart__swatch wpm-chart__swatch--raw" />
        raw {{ hoveredPoint.raw }}
      </span>
      <span v-if="hoveredPoint.errors > 0">
        <i class="wpm-chart__swatch wpm-chart__swatch--errors" />
        errors {{ hoveredPoint.errors }}
      </span>
    </div>

    <figcaption class="wpm-chart__legend">
      <span>
        <i class="wpm-chart__swatch wpm-chart__swatch--wpm" />
        wpm
      </span>
      <span>
        <i class="wpm-chart__swatch wpm-chart__swatch--raw" />
        raw
      </span>
      <span>
        <i class="wpm-chart__swatch wpm-chart__swatch--errors" />
        errors
      </span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
  import { computed, ref, useTemplateRef } from 'vue'
  import { useElementSize } from '@vueuse/core'

  import type { TimelinePoint } from '@typemore/core'

  /**
   * WPM-over-time chart for the results screen. Pure view: it charts a
   * `TimelinePoint[]` (itself a pure function of the log — see stats.ts) so a
   * replay of the same log draws the same graph. Two line series — the
   * cumulative net wpm and the instantaneous raw, the latter filled down to the
   * axis — plus error markers on a secondary axis and the run's average.
   *
   * The fill is there for the wpm line's sake: it is the number the screen is
   * read for, and a 2px accent line over an empty grid is a thinner mark than it
   * deserves. Over the raw terrain it reads immediately.
   *
   * SVG, not canvas, and deliberately: every colour is a CSS custom property
   * (`--main-color`, `--sub-color`, `--error-color`) applied through the scoped
   * stylesheet below, so switching the theme repaints the chart with zero JS and
   * no redraw — a canvas has to be re-rendered because it can only bake in the
   * colours it read at draw time.
   */
  const props = defineProps<{ timeline: readonly TimelinePoint[] }>()

  const HEIGHT = 240
  const PAD = { top: 16, right: 44, bottom: 34, left: 48 } as const
  /** Used until the element has been measured (and in DOM-less environments). */
  const FALLBACK_WIDTH = 640

  const root = useTemplateRef<HTMLElement>('root')
  const { width: measured } = useElementSize(root)
  const width = computed(() => Math.max(320, Math.round(measured.value) || FALLBACK_WIDTH))

  const plotWidth = computed(() => width.value - PAD.left - PAD.right)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const plotMiddle = PAD.top + plotHeight / 2

  const points = computed(() => props.timeline)
  const count = computed(() => points.value.length)

  /** Even category spacing, exactly like the old chart's category x-axis. */
  const xAt = (index: number): number =>
    count.value < 2
      ? PAD.left + plotWidth.value / 2
      : PAD.left + (index / (count.value - 1)) * plotWidth.value

  /** Round up to a readable axis ceiling (…40, 50, 100, 250…). */
  const niceMax = (raw: number, minimum: number): number => {
    const target = Math.max(raw, minimum)
    const magnitude = 10 ** Math.floor(Math.log10(target))
    for (const factor of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
      const candidate = magnitude * factor
      if (candidate >= target) return candidate
    }
    return magnitude * 10
  }

  const wpmMax = computed(() =>
    niceMax(Math.max(0, ...points.value.flatMap((p) => [p.wpm, p.raw])), 20)
  )
  const errorMax = computed(() => Math.max(1, ...points.value.map((p) => p.errors)))

  const yOf = (value: number): number =>
    PAD.top + plotHeight - (Math.min(value, wpmMax.value) / wpmMax.value) * plotHeight
  const y1Of = (value: number): number =>
    PAD.top + plotHeight - (Math.min(value, errorMax.value) / errorMax.value) * plotHeight

  const TICK_ROWS = 4
  const yTicks = computed(() =>
    Array.from({ length: TICK_ROWS + 1 }, (_, i) => {
      const value = (wpmMax.value / TICK_ROWS) * i
      return { value: Math.round(value), y: yOf(value) }
    })
  )
  /** Errors are whole numbers: at most one tick per error, never a fractional one. */
  const y1Ticks = computed(() => {
    const step = Math.max(1, Math.ceil(errorMax.value / TICK_ROWS))
    const ticks: { value: number; y: number }[] = []
    for (let value = 0; value <= errorMax.value; value += step) {
      ticks.push({ value, y: y1Of(value) })
    }
    return ticks
  })
  const xTicks = computed(() => {
    const every = Math.max(1, Math.ceil(count.value / 10))
    return points.value
      .map((point, index) => ({ second: point.second, x: xAt(index), index }))
      .filter((tick) => tick.index % every === 0 || tick.index === count.value - 1)
  })

  /**
   * Monotone cubic interpolation (Fritsch–Carlson): the same soft curve the old
   * `tension: 0.3` gave, minus the overshoot — a Catmull-Rom/Bezier spline can
   * dip a wpm series below zero between two low points.
   */
  const curve = (values: number[], scale: (value: number) => number): string => {
    const n = values.length
    if (n === 0) return ''
    const px = values.map((_, i) => xAt(i))
    const py = values.map((value) => scale(value))
    const at = (i: number): string => `${px[i].toFixed(2)} ${py[i].toFixed(2)}`
    if (n === 1) return `M ${at(0)}`

    const dx: number[] = []
    const slope: number[] = []
    for (let i = 0; i < n - 1; i++) {
      dx.push(px[i + 1] - px[i])
      slope.push((py[i + 1] - py[i]) / (px[i + 1] - px[i]))
    }
    const m: number[] = new Array(n)
    m[0] = slope[0]
    m[n - 1] = slope[n - 2]
    for (let i = 1; i < n - 1; i++) {
      if (slope[i - 1] * slope[i] <= 0) {
        m[i] = 0
      } else {
        const w1 = 2 * dx[i] + dx[i - 1]
        const w2 = dx[i] + 2 * dx[i - 1]
        m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])
      }
    }

    let d = `M ${at(0)}`
    for (let i = 0; i < n - 1; i++) {
      const c1x = px[i] + dx[i] / 3
      const c1y = py[i] + (m[i] * dx[i]) / 3
      const c2x = px[i + 1] - dx[i] / 3
      const c2y = py[i + 1] - (m[i + 1] * dx[i]) / 3
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${at(i + 1)}`
    }
    return d
  }

  const wpmPath = computed(() =>
    curve(
      points.value.map((point) => point.wpm),
      yOf
    )
  )
  const rawPath = computed(() =>
    curve(
      points.value.map((point) => point.raw),
      yOf
    )
  )

  const baselineY = PAD.top + plotHeight

  /**
   * The raw curve closed down to the axis. A single point has no area to fill —
   * a `Z` back to its own coordinate would be an invisible zero-width sliver,
   * and the empty string is what keeps the element out of the DOM entirely.
   */
  const rawArea = computed(() => {
    if (count.value < 2) return ''
    const right = xAt(count.value - 1).toFixed(2)
    const left = xAt(0).toFixed(2)
    return `${rawPath.value} L ${right} ${baselineY} L ${left} ${baselineY} Z`
  })

  /**
   * The run's average — the last cumulative point, which IS the summary's own
   * wpm. One horizontal line saying "this is the number you got", so the early
   * part of the curve can be read as above or below it.
   */
  const average = computed(() => {
    const last = points.value[count.value - 1]
    if (!last || count.value < 2) return null
    return { value: Math.round(last.wpm), y: yOf(last.wpm) }
  })

  const errorMarks = computed(() =>
    points.value
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.errors > 0)
      .map(({ point, index }) => ({
        second: point.second,
        transform: `translate(${xAt(index).toFixed(2)} ${y1Of(point.errors).toFixed(2)})`
      }))
  )

  const hovered = ref<number | null>(null)
  const hoveredPoint = computed(() => {
    const index = hovered.value
    if (index === null) return null
    const point = points.value[index]
    if (!point) return null
    return {
      second: point.second,
      wpm: Math.round(point.wpm),
      raw: Math.round(point.raw),
      errors: point.errors,
      x: xAt(index),
      wpmY: yOf(point.wpm),
      rawY: yOf(point.raw)
    }
  })

  /** Nearest point by x — the old chart's `interaction: { mode: 'index' }`. */
  function onPointerMove(event: PointerEvent): void {
    if (count.value === 0) return
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const x = event.clientX - box.left
    const ratio = (x - PAD.left) / (plotWidth.value || 1)
    const index = Math.round(ratio * Math.max(1, count.value - 1))
    hovered.value = Math.min(count.value - 1, Math.max(0, index))
  }

  const ariaLabel = computed(() => {
    const last = points.value[points.value.length - 1]
    if (!last) return 'words per minute over time'
    return `words per minute over ${last.second} seconds, ending at ${Math.round(last.wpm)} wpm`
  })
</script>

<style lang="scss" scoped>
  .wpm-chart {
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

    &__axis--title text {
      font-size: 11px;
    }

    /*
     * The raw series' terrain. A WASH, not a second weight of line: the two
     * lines are what carry meaning, and this is the ground they are read
     * against. `sub` at 14% is dark enough on every theme to read as mass and
     * light enough that the 1.5px raw line on top of it is still its own edge —
     * the fill wears its own series' colour, so it can never be mistaken for a
     * third measurement.
     */
    &__area {
      stroke: none;

      &--raw {
        fill: var(--sub-color);
        fill-opacity: 0.17;
      }
    }

    &__average {
      line {
        stroke: var(--sub-color);
        stroke-dasharray: 6 4;
        stroke-width: 1;
      }

      text {
        font-size: 10px;
        fill: var(--sub-color);
      }
    }

    &__line {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;

      &--wpm {
        stroke: var(--main-color);
        stroke-width: 2;
      }

      &--raw {
        stroke: var(--sub-color);
        stroke-width: 1.5;
      }
    }

    &__errors line {
      stroke: var(--error-color);
      stroke-width: 2;
      stroke-linecap: round;
    }

    &__cursor line {
      stroke: var(--sub-color);
      stroke-width: 1;
    }

    &__dot {
      &--wpm {
        fill: var(--main-color);
      }

      &--raw {
        fill: var(--sub-color);
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

      &--wpm {
        background-color: var(--main-color);
      }

      &--raw {
        background-color: var(--sub-color);
      }

      &--errors {
        background-color: var(--error-color);
      }
    }
  }
</style>
