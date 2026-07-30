<template>
  <div class="input-history" data-testid="input-history">
    <div class="input-history__controls flex items-center">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            color="shadow"
            size="icon-sm"
            :aria-label="t('results.history.copyWords')"
            data-testid="history-copy-words"
            @click="copyWords"
          >
            <IconCopy class="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('results.history.copyWords') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            color="shadow"
            size="icon-sm"
            :aria-label="t('results.history.copyMissed')"
            :disabled="missedWords.length === 0"
            data-testid="history-copy-missed"
            @click="copyMissed"
          >
            <IconCopyX class="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('results.history.copyMissed') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            color="shadow"
            size="icon-sm"
            :aria-label="t('results.history.heatmap')"
            :class="{ 'text-main': heatmap }"
            data-testid="history-heatmap"
            @click="heatmap = !heatmap"
          >
            <IconFlame class="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('results.history.heatmap') }}</TooltipContent>
      </Tooltip>
      <div v-if="heatmap" class="input-history__legend h-fit" data-testid="history-legend">
        <span
          v-for="(range, bucket) in legend"
          :key="bucket"
          class="input-history__legend-item"
          :class="`input-history__legend-item--h${bucket}`"
        >
          {{ range }}
        </span>
      </div>
    </div>

    <!-- The hover tooltip is pointer-supplementary: the same letters are on
         screen, and a tab stop per word (runs are hundreds) would wreck
         keyboard navigation — hence delegation on the container. -->
    <!-- eslint-disable-next-line vuejs-accessibility/mouse-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
    <div
      class="input-history__words p-2"
      :class="{ 'input-history__words--heatmap': heatmap }"
      @mouseover="onOver"
      @mouseout="onOut"
    >
      <div
        v-for="(entry, index) in history"
        :key="index"
        class="input-history__word"
        :class="heatmap ? wordBucketClass(entry) : null"
        :data-index="index"
      >
        <TestWord
          :word="entry.target"
          :typed="entry.typed"
          :active="false"
          :committed="entry.committed"
        />

        <!-- Inside the word itself (monkeytype's wordInputHighlight): the
             overlay is a CHILD of the hovered word, stretched over it, so no
             ancestor overflow (the grid-collapse wrapper) can cut it off. -->
        <div
          v-if="hoveredIndex === index"
          class="input-history__overlay"
          data-testid="history-tooltip"
        >
          <span v-if="entry.typed !== ''" class="input-history__overlay-typed">
            {{ entry.typed }}
          </span>
          <span class="input-history__overlay-speed">{{ speedLabel(entry.burst) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { WordHistoryEntry } from '@typemore/core'
  import { TestWord } from '@/features/test/word'
  import IconCopy from '~icons/tabler/copy'
  import IconCopyX from '~icons/tabler/copy-x'
  import IconFlame from '~icons/tabler/flame'
  import { Button } from '@/shared/ui/button'
  import { toast } from '@/shared/ui/sonner'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

  /**
   * Input history of a finished run (monkeytype's "words history"): every
   * reached word rendered with its typed letters, a hover tooltip with the
   * typed text and the word's burst WPM, an optional burst heatmap, and the
   * two copy actions (full word list / missed words).
   *
   * Pure view over `WordHistoryEntry[]` — hosts compute it from the log
   * (`wordHistory`, shared/core) so the same block serves the solo results and
   * the leaderboard run page.
   *
   * The words render in the LIGHT dom on purpose. The live field hides its
   * words in a shadow root as an anti-scrape layer, but a finished run's text
   * is the player's own — "copy word list" hands it out one button away. That
   * also means the field's shadow styles don't reach here, so the letter
   * colours are (re)declared locally.
   */
  const props = defineProps<{ history: readonly WordHistoryEntry[] }>()

  const { t } = useI18n()

  const heatmap = ref(false)

  const missedWords = computed(() =>
    props.history.filter((entry) => entry.committed && entry.typed !== entry.target)
  )

  /**
   * Clipboard first; on ANY failure (permissions, insecure context) fall back
   * to downloading the same text as a `.txt` — the list must leave the page one
   * way or the other.
   */
  const copyOrSave = async (text: string, filename: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('results.history.copied'))
    } catch {
      try {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        toast.success(t('results.history.savedFile', { filename }))
      } catch {
        toast.error(t('results.history.copyFailed'))
      }
    }
  }

  const copyWords = (): Promise<void> =>
    copyOrSave(props.history.map((entry) => entry.target).join(' '), 'words.txt')

  const copyMissed = (): Promise<void> =>
    copyOrSave(missedWords.value.map((entry) => entry.target).join(' '), 'missed-words.txt')

  // ── Burst heatmap ──────────────────────────────────────────────────────────
  // Quantile scale, monkeytype's exact cut points: thresholds at the 15/35/65/85th
  // percentiles of the measured bursts, five buckets coloured from error to main.

  const QUANTILES = [0.15, 0.35, 0.65, 0.85] as const

  const thresholds = computed<number[]>(() => {
    const bursts = props.history
      .map((entry) => entry.burst)
      .filter((burst): burst is number => burst !== undefined)
      .sort((a, b) => a - b)
    if (bursts.length === 0) return [0, 0, 0, 0, 0]
    return [0, ...QUANTILES.map((q) => bursts[Math.floor(bursts.length * q)])]
  })

  const bucketOf = (burst: number): number => {
    let bucket = 0
    for (let i = 1; i < thresholds.value.length; i++) {
      if (burst >= thresholds.value[i]) bucket = i
    }
    return bucket
  }

  const wordBucketClass = (entry: WordHistoryEntry): string =>
    entry.burst === undefined
      ? 'input-history__word--unmeasured'
      : `input-history__word--h${bucketOf(entry.burst)}`

  /** Legend ranges: `<b`, `a–b`, …, `a+`, matching the bucket boundaries. */
  const legend = computed<string[]>(() => {
    const steps = thresholds.value.map((value) =>
      Number.isFinite(value) ? Math.round(value) : Infinity
    )
    return steps.map((value, index) => {
      const next = steps[index + 1]
      if (index === 0) return `<${next}`
      if (next === undefined) return `${value}+`
      return next > value ? `${value}–${next - 1}` : `${value}`
    })
  })

  // ── Hover overlay ──────────────────────────────────────────────────────────
  // Delegation on the container tracks WHICH word is hovered; the overlay
  // renders as a child of that word (monkeytype's wordInputHighlight), so it
  // needs no coordinates and no ancestor can clip it. One mounted overlay at a
  // time — a run can be hundreds of words, one popover per word is overhead.

  const hoveredIndex = ref<number | null>(null)

  const speedLabel = (burst: number | undefined): string => {
    if (burst === undefined) return '—'
    if (!Number.isFinite(burst)) return '∞'
    return `${Math.round(burst)} wpm`
  }

  const wordIndexOf = (target: EventTarget | null): number | null => {
    if (!(target instanceof Element)) return null
    const host = target.closest('[data-index]')
    if (!(host instanceof HTMLElement)) return null
    const index = Number(host.dataset.index)
    return Number.isInteger(index) ? index : null
  }

  const onOver = (event: MouseEvent): void => {
    const index = wordIndexOf(event.target)
    if (index !== null) hoveredIndex.value = index
  }

  const onOut = (event: MouseEvent): void => {
    if (wordIndexOf(event.target) !== null) hoveredIndex.value = null
  }
</script>

<style lang="scss" scoped>
  .input-history {
    // Bucket palette. color-mix over theme tokens instead of JS blending:
    // stays correct under every theme with no colour math to maintain. On the
    // block root so the legend and the words read the same variables.
    --ih-h0: var(--error-color);
    --ih-h1: color-mix(in oklab, var(--error-color) 50%, var(--text-color));
    --ih-h2: var(--text-color);
    --ih-h3: color-mix(in oklab, var(--main-color) 50%, var(--text-color));
    --ih-h4: var(--main-color);

    display: flex;
    flex-direction: column;
    width: 100%;

    &__controls {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-start;
    }

    &__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      justify-content: flex-start;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }

    // Filled swatches (monkeytype's legend boxes): the range sits ON its bucket
    // colour, so slow-to-fast reads as a scale rather than tinted numbers.
    &__legend-item {
      padding: 0.125rem 0.5rem;
      color: var(--bg-color);
      border-radius: var(--border-radius);

      @for $i from 0 through 4 {
        &--h#{$i} {
          background-color: var(--ih-h#{$i});
        }
      }
    }

    &__words {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
    }

    // Anchor for the hover overlay: the overlay is a child of the word wrapper
    // and stretches over exactly this box.
    &__word {
      position: relative;
    }

    // The field's shadow styles don't reach the light dom; the same class
    // names get a results-sized restatement here (smaller type, same colours).
    &__word :deep(.word) {
      position: relative;
      margin: 0 0.3em;
      font-size: 1rem;
      line-height: 1.6em;
      color: var(--sub-color);
      border-bottom: 2px solid transparent;
    }

    &__word :deep(.word--error) {
      border-bottom-color: var(--error-color);
    }

    &__word :deep(.letter) {
      display: inline-block;
      line-height: 1em;
    }

    &__word :deep(.correct) {
      color: var(--text-color);
    }

    &__word :deep(.incorrect) {
      color: var(--error-color);
    }

    &__word :deep(.extra) {
      color: var(--error-extra-color, var(--error-color));
    }

    &__word :deep(.missed) {
      color: var(--sub-color);
    }

    &__word :deep(.letter--ws) {
      opacity: 0.45;
    }

    // Heatmap paints the WHOLE word its bucket colour — correctness colouring
    // yields to speed while the toggle is on (the underline still marks errors).
    @for $i from 0 through 4 {
      &__word--h#{$i} :deep(.letter) {
        color: var(--ih-h#{$i});
      }
    }

    &__word--unmeasured :deep(.letter) {
      color: var(--sub-color);
    }

    // monkeytype's wordInputHighlight: a child of the hovered word, centred on
    // it and at least as wide (`min-width: 100%` of the wrapper), growing to
    // its content when the typed text is longer. Clipping-proof by
    // construction — it lives inside the box it decorates.
    &__overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: max-content;
      min-width: calc(100% + 0.5rem);
      padding: 0.25rem 0.5rem;
      font-size: 0.8125rem;
      line-height: 1.2;
      pointer-events: none;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
      box-shadow: 0 0 0.5rem rgb(0 0 0 / 25%);
      transform: translate(-50%, -50%);
    }

    &__overlay-typed {
      max-width: 16rem;
      overflow-wrap: anywhere;
      color: var(--text-color);
    }

    &__overlay-speed {
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: var(--main-color);
    }
  }
</style>
