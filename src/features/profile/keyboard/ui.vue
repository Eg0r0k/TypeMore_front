<template>
  <div class="pf-kbd" data-testid="profile-keyboard">
    <div class="pf-kbd__controls">
      <!-- Layout toggle; the DEFAULT follows the profile's dominant language. -->
      <ToggleGroup
        :model-value="layoutName"
        type="single"
        :aria-label="t('profile.keyboard.layout')"
        @update:model-value="onLayout"
      >
        <ToggleGroupItem
          v-for="l in layouts"
          :key="l.name"
          :value="l.name"
          :data-testid="`profile-kbd-layout-${l.name}`"
        >
          {{ l.label }}
        </ToggleGroupItem>
      </ToggleGroup>

      <!-- Metric toggle: accuracy (error rate) | speed (mean interval). -->
      <ToggleGroup
        :model-value="metric"
        type="single"
        :aria-label="t('profile.keyboard.metric')"
        @update:model-value="onMetric"
      >
        <ToggleGroupItem value="accuracy" data-testid="profile-kbd-metric-accuracy">
          {{ t('profile.keyboard.accuracy') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="speed" data-testid="profile-kbd-metric-speed">
          {{ t('profile.keyboard.speed') }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <TooltipProvider :delay-duration="100">
      <svg
        v-if="layout"
        class="pf-kbd__svg"
        :viewBox="`0 0 ${GRID_W * UNIT} ${rows * UNIT}`"
        role="img"
        :aria-label="t('profile.keyboard.aria')"
      >
        <template v-for="key in drawnKeys" :key="key.id">
          <Tooltip>
            <TooltipTrigger as-child>
              <g
                class="pf-kbd__key"
                :data-testid="`profile-kbd-key-${key.id}`"
                :data-tone="key.tone"
              >
                <rect
                  :x="key.x + 1.5"
                  :y="key.y + 1.5"
                  :width="key.w - 3"
                  :height="UNIT - 3"
                  rx="4"
                  :style="{ fill: key.fill }"
                />
                <text
                  :x="key.x + key.w / 2"
                  :y="key.y + UNIT / 2"
                  text-anchor="middle"
                  dominant-baseline="central"
                >
                  {{ key.label }}
                </text>
              </g>
            </TooltipTrigger>
            <TooltipContent>
              <div class="pf-kbd__tip" :data-testid="`profile-kbd-tip-${key.id}`">
                <b>{{ key.label === ' ' ? 'space' : key.label }}</b>
                <template v-if="key.stats">
                  <span>{{ t('profile.keyboard.presses', { n: grouped(key.stats.count) }) }}</span>
                  <span>
                    {{ t('profile.keyboard.errors', { p: percent(key.stats.errorRate) }) }}
                  </span>
                  <span v-if="key.stats.intervals > 0">
                    {{
                      t('profile.keyboard.interval', { ms: Math.round(key.stats.avgIntervalMs) })
                    }}
                  </span>
                </template>
                <span v-if="key.tone === 'low-data'" class="pf-kbd__tip-low">
                  {{ t('profile.keyboard.lowData') }}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </template>
      </svg>
    </TooltipProvider>

    <div v-if="empty" class="pf-kbd__note" data-testid="profile-keyboard-empty">
      <Typography size="s" color="sub">{{ t('profile.keyboard.empty') }}</Typography>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { KeyboardLayout, ProfileKeyboard } from '@shared/api'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import { grouped, percent } from '../model/format'

  /**
   * The keyboard heatmap (C9): an SVG keyboard drawn from the layouts DATA
   * asset, keys coloured through a design-token scale by one of two metrics —
   * accuracy (error rate) or speed (mean inter-key interval). Colours are
   * derived from `--main-color` / `--error-color` via color-mix, so themes
   * repaint the map exactly like the charts.
   *
   * HONESTY RULE: a key under the observation minimum renders NEUTRAL with an
   * "insufficient data" tooltip — three presses are an anecdote, and colouring
   * them would fake a confidence the data does not have.
   */
  const props = defineProps<{
    keyboard: ProfileKeyboard
    layouts: readonly KeyboardLayout[]
  }>()
  const { t } = useI18n()

  /** Minimum observations before a key earns a colour. */
  const MIN_PRESSES = 20
  const MIN_INTERVALS = 20

  const UNIT = 44
  const GRID_W = 15

  const metric = ref<'accuracy' | 'speed'>('accuracy')
  const layoutName = ref('')
  watch(
    () => props.keyboard.layout,
    (fallback) => {
      if (layoutName.value === '') layoutName.value = fallback
    },
    { immediate: true }
  )
  const onLayout = (value: unknown): void => {
    if (typeof value === 'string' && value !== '') layoutName.value = value
  }
  const onMetric = (value: unknown): void => {
    if (value === 'accuracy' || value === 'speed') metric.value = value
  }

  const layout = computed(
    () => props.layouts.find((l) => l.name === layoutName.value) ?? props.layouts[0]
  )
  const rows = computed(() => 1 + Math.max(0, ...(layout.value?.keys.map((k) => k.row) ?? [0])))

  const byKeyId = computed(() => new Map(props.keyboard.keys.map((k) => [k.keyId, k])))
  const empty = computed(() => props.keyboard.keys.length === 0)

  /**
   * The metric's [0, 1] "badness" for a key, scaled against the visible keys'
   * own range so the map always uses its full contrast.
   */
  const badness = computed(() => {
    const eligible = props.keyboard.keys.filter((k) =>
      metric.value === 'accuracy' ? k.count >= MIN_PRESSES : k.intervals >= MIN_INTERVALS
    )
    const values = eligible.map((k) =>
      metric.value === 'accuracy' ? k.errorRate : k.avgIntervalMs
    )
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const span = hi - lo
    const map = new Map<string, number>()
    for (const k of eligible) {
      const value = metric.value === 'accuracy' ? k.errorRate : k.avgIntervalMs
      map.set(k.keyId, span <= 0 ? 0 : (value - lo) / span)
    }
    return map
  })

  interface DrawnKey {
    id: string
    label: string
    x: number
    y: number
    w: number
    fill: string
    tone: 'scored' | 'low-data' | 'unused'
    stats: ProfileKeyboard['keys'][number] | undefined
  }

  const drawnKeys = computed<DrawnKey[]>(() => {
    const current = layout.value
    if (!current) return []
    // Row-relative columns → x offsets; a key's width is in key units.
    const rowsPos = new Map<number, number>()
    return current.keys.map((key) => {
      const x = (rowsPos.get(key.row) ?? 0) * UNIT
      rowsPos.set(key.row, (rowsPos.get(key.row) ?? 0) + (key.width ?? 1))
      const stats = byKeyId.value.get(key.id)
      const score = badness.value.get(key.id)
      let tone: DrawnKey['tone'] = 'unused'
      let fill = 'var(--sub-alt-color)'
      if (score !== undefined) {
        tone = 'scored'
        // Token scale: good = main colour, bad = error colour.
        fill = `color-mix(in srgb, var(--error-color) ${Math.round(score * 100)}%, var(--main-color))`
      } else if (stats !== undefined && stats.count > 0) {
        tone = 'low-data'
      }
      return {
        id: key.id,
        label: key.chars[0] ?? key.id,
        x,
        y: key.row * UNIT,
        w: (key.width ?? 1) * UNIT,
        fill,
        tone,
        stats
      }
    })
  })
</script>

<style lang="scss" scoped>
  .pf-kbd {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
    }

    &__svg {
      width: 100%;
      max-width: 46rem;
      overflow: visible;
    }

    &__key {
      rect {
        stroke: var(--bg-color);
        stroke-width: 1;
        transition: fill 0.2s ease;
      }

      text {
        font-size: 13px;
        fill: var(--text-color);
        pointer-events: none;
        user-select: none;
      }

      &[data-tone='low-data'] rect {
        fill: var(--sub-alt-color);
        stroke: var(--sub-color);
        stroke-dasharray: 3 3;
      }
    }

    &__tip {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-variant-numeric: tabular-nums;
    }

    &__tip-low {
      color: var(--sub-color);
    }

    &__note {
      padding: 0.75rem 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
