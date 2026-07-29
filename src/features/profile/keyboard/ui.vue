<template>
  <div class="pf-kbd" data-testid="profile-keyboard">
    <TooltipProvider :delay-duration="100">
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

        <div class="pf-kbd__metric">
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

          <!-- What the colours MEAN under the current metric — the map itself
               only shows the scale, this names it. -->
          <Tooltip>
            <TooltipTrigger as-child>
              <span
                class="pf-kbd__metric-hint"
                :aria-label="t('profile.keyboard.metric')"
                data-testid="profile-kbd-metric-hint"
              >
                <IconInfoCircle class="size-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span class="pf-kbd__tip">
                {{
                  metric === 'accuracy'
                    ? t('profile.keyboard.accuracyHint')
                    : t('profile.keyboard.speedHint')
                }}
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- The key map: plain keycap rows (the virtual key-map look), each cap
           coloured by the metric through the same design-token scale as the
           charts. -->
      <div
        v-if="layout"
        class="pf-kbd__map"
        role="img"
        :aria-label="t('profile.keyboard.aria')"
      >
        <div v-for="row in drawnRows" :key="row.row" class="pf-kbd__row">
          <!-- The trigger IS the keycap (no as-child: reka's slot merge drops
               the style binding, and the cap's paint rides on `style`). -->
          <Tooltip v-for="key in row.keys" :key="key.id">
            <TooltipTrigger
              type="button"
              class="pf-kbd__key"
              :data-testid="`profile-kbd-key-${key.id}`"
              :data-tone="key.tone"
              :style="keyStyle(key)"
            >
              <b>{{ key.label }}</b>
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
        </div>
      </div>
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
  import IconInfoCircle from '~icons/tabler/info-circle'
  import { grouped, percent } from '../model/format'

  /**
   * The keyboard heatmap (C9), drawn as a KEYCAP keyboard (the virtual key-map
   * look: rows of caps, a wide space bar) from the layouts DATA asset. Keys are
   * coloured through a design-token scale by one of two metrics — accuracy
   * (error rate) or speed (mean inter-key interval). Colours are derived from
   * `--main-color` / `--error-color` via color-mix, so themes repaint the map
   * exactly like the charts. Every cap carries a tooltip with the key's real
   * numbers, and the metric toggle carries one naming what the colours mean.
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
    /** Cap width in key units (1 = a letter cap; the space bar is several). */
    units: number
    /** Metric colour for a scored cap; null keeps the neutral cap colour. */
    fill: string | null
    tone: 'scored' | 'low-data' | 'unused'
    stats: ProfileKeyboard['keys'][number] | undefined
  }

  const drawnRows = computed<{ row: number; keys: DrawnKey[] }[]>(() => {
    const current = layout.value
    if (!current) return []
    const rows = new Map<number, DrawnKey[]>()
    for (const key of [...current.keys].sort((a, b) => a.row - b.row || a.col - b.col)) {
      const stats = byKeyId.value.get(key.id)
      const score = badness.value.get(key.id)
      let tone: DrawnKey['tone'] = 'unused'
      let fill: string | null = null
      if (score !== undefined) {
        tone = 'scored'
        // Token scale: good = main colour, bad = error colour.
        fill = `color-mix(in srgb, var(--error-color) ${Math.round(score * 100)}%, var(--main-color))`
      } else if (stats !== undefined && stats.count > 0) {
        tone = 'low-data'
      }
      const drawn: DrawnKey = {
        id: key.id,
        label: key.chars[0] ?? key.id,
        units: key.width ?? 1,
        fill,
        tone,
        stats
      }
      const bucket = rows.get(key.row)
      if (bucket === undefined) rows.set(key.row, [drawn])
      else bucket.push(drawn)
    }
    return [...rows.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, keys]) => ({ row, keys }))
  })

  /**
   * Cap geometry + metric colour, carried as CUSTOM properties — the stylesheet
   * turns them into width/background. Real properties would also work in a
   * browser, but happy-dom validates their values and silently drops
   * `color-mix(...)`/`calc(...)`; custom properties pass through unparsed.
   */
  const keyStyle = (key: DrawnKey): Record<string, string> => {
    const style: Record<string, string> = { '--pf-kbd-w': String(key.units) }
    if (key.fill !== null) style['--pf-kbd-fill'] = key.fill
    return style
  }
</script>

<style lang="scss" scoped>
  .pf-kbd {
    --pf-kbd-unit: 2.5rem;
    --pf-kbd-gap: 6px;

    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
    }

    &__metric {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    &__metric-hint {
      display: inline-flex;
      color: var(--sub-color);
      cursor: help;

      &:hover {
        color: var(--text-color);
      }
    }

    &__map {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      user-select: none;
    }

    &__row {
      display: flex;
      gap: var(--pf-kbd-gap);
    }

    // A <button> under the hood (the tooltip trigger), reset back to a keycap.
    // A multi-unit cap (the space bar) absorbs the gaps it spans.
    &__key {
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(
        var(--pf-kbd-w, 1) * var(--pf-kbd-unit) + (var(--pf-kbd-w, 1) - 1) * var(--pf-kbd-gap)
      );
      height: var(--pf-kbd-unit);
      padding: 0;
      font: inherit;
      font-size: 0.8125rem;
      color: var(--main-color);
      text-align: center;
      cursor: default;
      background-color: var(--sub-alt-color);
      border: 0;
      border-bottom: 1px solid var(--main-color);
      border-radius: 5px;
      transition: all 0.1s;

      // A scored cap is painted by the metric: the label flips to the page
      // background for contrast and the accent underline dissolves into it.
      &[data-tone='scored'] {
        color: var(--bg-color);
        background-color: var(--pf-kbd-fill, var(--sub-alt-color));
        border-bottom-color: transparent;
      }

      &[data-tone='low-data'] {
        color: var(--sub-color);
        border: 1px dashed var(--sub-color);
      }
    }

    &__tip {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 16rem;
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

  // The full board is ~15 units wide; on a narrow card the caps shrink with it.
  @media screen and (width <= 700px) {
    .pf-kbd {
      --pf-kbd-unit: 1.9rem;
    }

    .pf-kbd__key {
      font-size: 0.6875rem;
    }
  }
</style>
