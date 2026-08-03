<template>
  <div
    class="flex flex-col gap-3 [--pf-gap:3px] [--pf-key:1.15rem] sm:[--pf-gap:4px] sm:[--pf-key:1.6rem] md:[--pf-key:2.1rem] lg:[--pf-gap:6px] lg:[--pf-key:2.5rem]"
    data-testid="profile-keyboard"
  >
    <TooltipProvider :delay-duration="100">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <!-- Layout choice: latin presets only (model/layouts.ts). On a narrow
             card the strip scrolls rather than wrapping into a second row. -->
        <div class="-mx-1 overflow-x-auto px-1 py-0.5">
          <ToggleGroup
            :model-value="layoutName"
            type="single"
            size="sm"
            :aria-label="t('profile.keyboard.layout')"
            @update:model-value="onLayout"
          >
            <ToggleGroupItem
              v-for="preset in KEYBOARD_LAYOUT_PRESETS"
              :key="preset.name"
              :value="preset.name"
              class="text-xs"
              :data-testid="`profile-kbd-layout-${preset.name}`"
            >
              {{ preset.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div class="flex items-center gap-2">
          <!-- Metric toggle: accuracy (error rate) | speed (mean interval). -->
          <ToggleGroup
            :model-value="metric"
            type="single"
            size="sm"
            :aria-label="t('profile.keyboard.metric')"
            @update:model-value="onMetric"
          >
            <ToggleGroupItem
              value="accuracy"
              class="text-xs"
              data-testid="profile-kbd-metric-accuracy"
            >
              {{ t('profile.keyboard.accuracy') }}
            </ToggleGroupItem>
            <ToggleGroupItem value="speed" class="text-xs" data-testid="profile-kbd-metric-speed">
              {{ t('profile.keyboard.speed') }}
            </ToggleGroupItem>
          </ToggleGroup>

          <!-- What the colours MEAN under the current metric — the map itself
               only shows the scale, this names it. -->
          <Tooltip>
            <TooltipTrigger
              type="button"
              class="inline-flex cursor-help rounded-md text-sub transition-tm focus-ring hover:text-text"
              :aria-label="t('profile.keyboard.metric')"
              data-testid="profile-kbd-metric-hint"
            >
              <IconInfoCircle class="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              <span class="flex max-w-64 flex-col gap-0.5">
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
           charts. Rows are centred, so the board stays symmetric at any width. -->
      <div
        class="flex select-none flex-col items-center gap-[var(--pf-gap)] overflow-x-auto py-1"
        role="img"
        :aria-label="t('profile.keyboard.aria')"
      >
        <div
          v-for="(keys, index) in drawnRows"
          :key="index"
          class="flex shrink-0 gap-[var(--pf-gap)]"
        >
          <!-- The trigger IS the keycap (no as-child: reka's slot merge drops
               the style binding, and the cap's paint rides on `style`). -->
          <Tooltip v-for="key in keys" :key="key.id">
            <TooltipTrigger
              type="button"
              class="flex h-[var(--pf-key)] w-[calc(var(--pf-kbd-w,1)*var(--pf-key)+(var(--pf-kbd-w,1)-1)*var(--pf-gap))] cursor-default items-center justify-center rounded-[5px] border-b border-main bg-sub-alt p-0 font-sans text-[calc(var(--pf-key)*0.36)] text-main transition-tm data-[tone=low-data]:border data-[tone=low-data]:border-dashed data-[tone=low-data]:border-sub data-[tone=low-data]:text-sub data-[tone=scored]:border-b-transparent data-[tone=scored]:bg-[var(--pf-kbd-fill)] data-[tone=scored]:text-bg"
              :data-testid="`profile-kbd-key-${key.id}`"
              :data-tone="key.tone"
              :style="keyStyle(key)"
            >
              <b class="font-normal">{{ key.label }}</b>
            </TooltipTrigger>
            <TooltipContent>
              <div
                class="flex max-w-64 flex-col gap-0.5 tabular-nums"
                :data-testid="`profile-kbd-tip-${key.id}`"
              >
                <b>{{ key.id === 'Space' ? 'space' : key.label }}</b>
                <template v-if="key.stats">
                  <span>{{ t('profile.keyboard.presses', { n: groupThousands(key.stats.count) }) }}</span>
                  <span>
                    {{ t('profile.keyboard.errors', { p: percent(key.stats.errorRate) }) }}
                  </span>
                  <span v-if="key.stats.intervals > 0">
                    {{
                      t('profile.keyboard.interval', { ms: Math.round(key.stats.avgIntervalMs) })
                    }}
                  </span>
                </template>
                <span v-if="key.tone === 'low-data'" class="text-sub">
                  {{ t('profile.keyboard.lowData') }}
                </span>
                <span v-else-if="key.tone === 'unused'" class="text-sub">
                  {{ t('profile.keyboard.unused') }}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>

    <!-- The colour scale, named by the metric currently painting it. -->
    <div
      v-if="!empty"
      class="flex items-center justify-center gap-2 text-[11px] text-sub"
      data-testid="profile-kbd-legend"
    >
      <span>{{ t(`profile.keyboard.legend.${metric}Best`) }}</span>
      <span
        class="h-2 w-24 rounded-sm bg-[linear-gradient(90deg,var(--main-color),var(--error-color))]"
      />
      <span>{{ t(`profile.keyboard.legend.${metric}Worst`) }}</span>
    </div>

    <div v-if="empty" class="rounded-lg bg-sub-alt px-4 py-3" data-testid="profile-keyboard-empty">
      <Typography size="s" color="sub">{{ t('profile.keyboard.empty') }}</Typography>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { ProfileKeyboard } from '@shared/api'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { groupThousands } from '@/shared/lib/helpers/numbers'
  import { Typography } from '@/shared/ui/typography'
  import IconInfoCircle from '~icons/tabler/info-circle'
  import { percent } from '@/shared/lib/helpers/numbers'
  import { KEYBOARD_LAYOUT_PRESETS, type LayoutKey, layoutByName } from '../model/layouts'

  /**
   * The keyboard heatmap (C9), drawn as a KEYCAP keyboard (the virtual key-map
   * look: rows of caps, a wide space bar) from the LAYOUT PRESETS in
   * model/layouts.ts. The server's aggregates are keyed on physical keys, so a
   * layout is purely a relabelling: switching to Dvorak repaints no colour, it
   * only changes which glyph sits on which cap. Keys are coloured through a
   * design-token scale by one of two metrics — accuracy (error rate) or speed
   * (mean inter-key interval). Colours are derived from `--main-color` /
   * `--error-color` via color-mix, so themes repaint the map exactly like the
   * charts.
   *
   * HONESTY RULE: a key under the observation minimum renders NEUTRAL with an
   * "insufficient data" tooltip — three presses are an anecdote, and colouring
   * them would fake a confidence the data does not have.
   */
  const props = defineProps<{ keyboard: ProfileKeyboard }>()
  const { t } = useI18n()

  /** Minimum observations before a key earns a colour. */
  const MIN_PRESSES = 20
  const MIN_INTERVALS = 20

  const metric = ref<'accuracy' | 'speed'>('accuracy')
  const layoutName = ref('')
  /**
   * The DEFAULT follows the profile's own layout when we ship it; a profile
   * mapped on a layout we dropped (ЙЦУКЕН) falls back to QWERTY rather than
   * rendering an empty board.
   */
  watch(
    () => props.keyboard.layout,
    (fallback) => {
      if (layoutName.value === '') layoutName.value = layoutByName(fallback).name
    },
    { immediate: true }
  )
  const onLayout = (value: unknown): void => {
    if (typeof value === 'string' && value !== '') layoutName.value = value
  }
  const onMetric = (value: unknown): void => {
    if (value === 'accuracy' || value === 'speed') metric.value = value
  }

  const layout = computed(() => layoutByName(layoutName.value))

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

  interface DrawnKey extends LayoutKey {
    /** Metric colour for a scored cap; null keeps the neutral cap colour. */
    fill: string | null
    tone: 'scored' | 'low-data' | 'unused'
    stats: ProfileKeyboard['keys'][number] | undefined
  }

  const drawnRows = computed<DrawnKey[][]>(() =>
    layout.value.rows.map((keys) =>
      keys.map((key) => {
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
        return { ...key, fill, tone, stats }
      })
    )
  )

  /**
   * Cap geometry + metric colour, carried as CUSTOM properties — the utility
   * classes turn them into width/background. Real properties would also work in
   * a browser, but happy-dom validates their values and silently drops
   * `color-mix(...)`/`calc(...)`; custom properties pass through unparsed.
   */
  const keyStyle = (key: DrawnKey): Record<string, string> => {
    const style: Record<string, string> = { '--pf-kbd-w': String(key.units) }
    if (key.fill !== null) style['--pf-kbd-fill'] = key.fill
    return style
  }
</script>
