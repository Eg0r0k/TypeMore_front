<template>
  <!--
    Decorative by contract: no axes, no labels, no tooltips, no accessible name.
    Every number it draws is stated in words elsewhere on the page (the charts
    section owns the readable version), so a screen reader is told nothing here
    rather than being read a shape.
  -->
  <svg
    v-if="path !== null"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
    class="size-full text-bg"
    aria-hidden="true"
    focusable="false"
    data-testid="profile-sparkline"
  >
    <!-- The area first, so the line sits on top of its own fill. It closes on
         the BOTTOM of the box, which is the bottom of the banner: the shape is
         a filled horizon, not a chart floating in the middle of it. -->
    <path :d="area" fill="currentColor" fill-opacity="0.14" />
    <path
      :d="path"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.45"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  /**
   * The banner's wpm line: the run-to-run shape of the recent runs.
   *
   * Three decisions make it read as a banner and not as a chart that wandered in.
   *
   * SMOOTHED — a three-run rolling mean. Consecutive runs differ by a dozen wpm
   * for reasons a profile header has no business narrating (a bad word, a
   * phone call); the trend across a fortnight is the only thing at this size.
   *
   * SCALED AGAINST A FLOOR — the range is never allowed below {@link MIN_SPAN}
   * wpm. Fitting min..max to the full height is what a chart does, and it turns
   * a steady typist's two-wpm wobble into an alpine ridge. With a floor, a
   * steady typist gets a steady line and a real climb still climbs.
   *
   * CURVED — the points are joined by monotone cubic segments rather than
   * straight ones. At this size the corners of a polyline are the loudest thing
   * in the banner, and they are an artefact of the sampling rate, not of how
   * anyone types.
   *
   * FILLED to the bottom edge. The line alone read as a stray chart pinned to
   * the top of the banner; closed into an area that reaches the floor, the same
   * data reads as the banner's own surface.
   *
   * Hand-rolled SVG on purpose: the chart library is for the charts SECTION,
   * where a reader takes numbers off the picture. Pulling a chart runtime in
   * here would cost more than a path draws.
   */
  const props = defineProps<{
    /** wpm per run, oldest first. Fewer than {@link MIN_POINTS} draws nothing. */
    points: readonly number[]
  }>()

  /** Below this the "line" is a couple of dots and says nothing — draw nothing. */
  const MIN_POINTS = 5
  /** The narrowest wpm range the height is allowed to represent. */
  const MIN_SPAN = 25
  const WINDOW = 3

  // The viewBox is stretched to the box by `preserveAspectRatio="none"`, so
  // these are proportions, not pixels; the stroke keeps its width regardless.
  const WIDTH = 100
  const HEIGHT = 32
  /** Half a stroke of air at the top, so the peak is not clipped. */
  const PAD = 2
  /**
   * The line lives in the TOP band of the box and the fill hangs below it. The
   * band stops well above the bottom-left corner, which the avatar overlaps.
   */
  const BAND = 0.55

  type Point = { readonly x: number; readonly y: number }

  /** Centred-ish rolling mean; the ends average what they have. */
  const smoothed = (values: readonly number[]): number[] =>
    values.map((_, index) => {
      const from = Math.max(0, index - Math.floor(WINDOW / 2))
      const window = values.slice(from, from + WINDOW)
      return window.reduce((sum, value) => sum + value, 0) / window.length
    })

  const at = (point: Point): string => `${point.x.toFixed(2)},${point.y.toFixed(2)}`

  /**
   * Monotone cubic interpolation (Fritsch–Carlson) as a cubic Bézier path.
   *
   * Smooth, and — unlike Catmull-Rom — it never overshoots the data: the curve
   * between two runs stays between their two values. That matters here because
   * the band has exactly {@link PAD} of headroom and none at all at the bottom,
   * so an overshooting spline would clip against the top edge and bleed past
   * the band into the avatar's corner. It also keeps the picture honest: a
   * bulge below the worst run would be a wpm nobody typed.
   */
  const curve = (points: readonly Point[]): string => {
    const count = points.length
    if (count < 2) return ''

    const dx = points.slice(1).map((point, index) => point.x - points[index].x)
    const slope = points.slice(1).map((point, index) => (point.y - points[index].y) / dx[index])

    const tangents = points.map((_, index) => {
      if (index === 0) return slope[0]
      if (index === count - 1) return slope[count - 2]

      const before = slope[index - 1]
      const after = slope[index]
      // A sign change (or a flat) is a local extremum: a zero tangent pins the
      // curve inside its two points instead of bowing past them.
      if (before * after <= 0) return 0

      // Weighted harmonic mean of the neighbouring slopes — the weights are what
      // keeps the result monotone on each segment.
      const w1 = 2 * dx[index] + dx[index - 1]
      const w2 = dx[index] + 2 * dx[index - 1]
      return (w1 + w2) / (w1 / before + w2 / after)
    })

    let d = `M ${at(points[0])}`
    for (let index = 0; index < count - 1; index += 1) {
      const step = dx[index] / 3
      const from = points[index]
      const to = points[index + 1]
      const control1: Point = { x: from.x + step, y: from.y + tangents[index] * step }
      const control2: Point = { x: to.x - step, y: to.y - tangents[index + 1] * step }
      d += ` C ${at(control1)} ${at(control2)} ${at(to)}`
    }
    return d
  }

  const path = computed<string | null>(() => {
    const values = props.points.filter((value) => Number.isFinite(value))
    if (values.length < MIN_POINTS) return null

    const line = smoothed(values)
    const min = Math.min(...line)
    const max = Math.max(...line)
    // The floor is applied around the middle of the actual range, so a flat
    // series sits in the middle of the band instead of on its floor.
    const middle = (min + max) / 2
    const span = Math.max(max - min, MIN_SPAN)
    const low = middle - span / 2
    const band = HEIGHT * BAND
    const usable = band - PAD

    return curve(
      line.map((value, index) => ({
        x: (index / (line.length - 1)) * WIDTH,
        y: band - ((value - low) / span) * usable
      }))
    )
  })

  /**
   * The same curve, closed down the sides to the bottom of the box. Empty (not
   * null) when there is no line — the `<svg>` above is gone in that case, and
   * an attribute typed `string | null` would only be an attribute Vue has to
   * decide how to drop.
   */
  const area = computed(() =>
    path.value === null ? '' : `${path.value} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z`
  )
</script>
