<template>
  <div class="results">
    <div class="results__main">
      <div class="results__primary">
        <div class="results__metric">
          <span class="results__label">wpm</span>
          <span class="results__value results__value--hero">{{ Math.round(metrics.wpm) }}</span>
        </div>
        <div class="results__metric">
          <span class="results__label">acc</span>
          <span class="results__value results__value--hero">
            {{ Math.round(metrics.accuracy * 100) }}%
          </span>
        </div>
      </div>
      <div class="results__chart">
        <WpmChart :timeline="timeline" />
      </div>
    </div>

    <div v-if="score" class="results__score">
      <span class="results__grade" :class="{ 'results__grade--top': isTopGrade }">{{ grade }}</span>
      <div class="results__metric results__score-total">
        <span class="results__label">score</span>
        <span class="results__value results__value--hero">{{ score.total }}</span>
      </div>
      <div class="results__breakdown">
        <span>base {{ Math.round(score.base) }}</span>
        <span>combo &times;{{ score.comboPeak }}</span>
        <span>acc {{ score.accMultiplier.toFixed(2) }}&times;</span>
        <span v-if="score.timeBonus !== null">time {{ score.timeBonus.toFixed(2) }}&times;</span>
        <span v-if="score.modMultiplier && score.modMultiplier > 1">
          mods &times;{{ score.modMultiplier.toFixed(2) }}
        </span>
        <span v-for="mod in activeMods" :key="mod.id" class="results__mod">
          {{ mod.id }} &times;{{ mod.multiplier.toFixed(2) }}
        </span>
        <span class="results__score-version">score v{{ score.version }}</span>
      </div>
    </div>

    <!-- <div class="results__secondary">
      <div class="results__metric">
        <span class="results__label">raw</span>
        <span class="results__value">{{ Math.round(metrics.raw) }}</span>
      </div>
      <div class="results__metric">
        <span class="results__label">consistency</span>
        <span class="results__value">{{ Math.round(metrics.consistency) }}%</span>
      </div>
      <div class="results__metric">
        <span class="results__label">characters</span>
        <span class="results__value results__value--chars">
          <span class="results__char results__char--correct">{{ metrics.chars.correct }}</span>
          /
          <span class="results__char results__char--incorrect">{{ metrics.chars.incorrect }}</span>
          /
          <span class="results__char results__char--extra">{{ metrics.chars.extra }}</span>
          /
          <span class="results__char results__char--missed">{{ metrics.chars.missed }}</span>
        </span>
      </div>
      <div class="results__metric">
        <span class="results__label">time</span>
        <span class="results__value">{{ Math.round(metrics.durationSec) }}s</span>
      </div>
    </div> -->

    <div class="results__meta">
      <span class="results__reason" :class="{ 'results__reason--fail': failReason }">
        {{ reason }}
      </span>
      <span class="results__config">{{ configLine }}</span>
      <span v-if="afkLabel" class="results__afk" data-testid="results-afk">{{ afkLabel }}</span>
    </div>

    <div class="results__actions">
      <Button
        color="main"
        button-label="watch replay"
        class="results__replay"
        @click="$emit('replay')"
      >
        <IconPlayerPlay />
        watch demo
      </Button>
    </div>

    <div v-if="errorWords.length" class="results__errors">
      <span class="results__label">error words</span>
      <ul class="results__errors-list">
        <li v-for="(word, index) in errorWords" :key="index" class="results__error-word">
          <span class="results__error-expected">{{ word.expected }}</span>
          <span class="results__error-typed">{{ word.typed || '∅' }}</span>
        </li>
      </ul>
    </div>

    <div
      v-if="saveState !== 'idle' && saveState !== 'ineligible'"
      class="results__save"
      data-testid="results-save"
    >
      <button
        v-if="saveState === 'guest'"
        type="button"
        class="results__save-link"
        data-testid="save-signin"
        @click="$emit('signin')"
      >
        {{ t('results.signIn') }}
      </button>
      <span
        v-else-if="saveState === 'saving'"
        class="results__save-status"
        data-testid="save-saving"
      >
        {{ t('results.saving') }}
      </span>
      <span
        v-else-if="saveState === 'saved'"
        class="results__save-status results__save-status--ok"
        data-testid="save-saved"
      >
        {{ t('results.savedPending') }}
      </span>
      <span
        v-else-if="saveState === 'error'"
        class="results__save-status results__save-status--error"
        data-testid="save-error"
      >
        {{ t('results.saveFailed') }}
        <Button
          color="main"
          button-label="retry"
          class="results__save-retry"
          data-testid="save-retry"
          @click="$emit('retry')"
        >
          {{ t('results.retry') }}
        </Button>
      </span>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import {
    type ActiveMod,
    type ErrorWord,
    type FailReason,
    type Metrics,
    type ScoreResult,
    type TimelinePoint,
    gradeOf
  } from '@shared/core'
  import WpmChart from './wpm-chart.vue'
  import IconPlayerPlay from '~icons/tabler/player-play'
  import { Button } from '@/shared/ui/button'

  /**
   * Pure results view. Every input is a pure function of the log (metrics, the wpm
   * timeline, the error-word list) computed in the store — this component holds no
   * state. Shows wpm/raw/accuracy/consistency, the character breakdown
   * (correct/incorrect/extra/missed), a wpm-over-time chart, the completion reason
   * (time / words / difficulty fail), the test config, and the mistyped words.
   */
  export interface ResultSummary {
    mode: string
    language: string
    difficulty: string
    amount: number
    punctuation: boolean
    numbers: boolean
    randomCase: boolean
    nospace: boolean
  }

  /**
   * Result-screen save state. Mirrors the run-submit feature's `SubmitState`; kept
   * local so this pure view carries no feature→feature import. `saved` means the
   * run is PENDING server validation — never a rank or leaderboard placement.
   */
  export type ResultsSaveState = 'idle' | 'ineligible' | 'guest' | 'saving' | 'saved' | 'error'

  const props = withDefaults(
    defineProps<{
      metrics: Metrics
      timeline: readonly TimelinePoint[]
      errorWords: readonly ErrorWord[]
      failReason: FailReason | null
      summary: ResultSummary
      /** Finalized score (v2); `null` hides the score block. */
      score: ScoreResult | null
      /** Active mods for the breakdown (empty when none). */
      activeMods: readonly ActiveMod[]
      /** Run-submit state; drives the subtle save hint. Defaults to `idle` (hidden). */
      saveState?: ResultsSaveState
      /** Idle time inside the run window (`afkOf`, shared/core); `0` hides the line. */
      afkMs?: number
    }>(),
    { saveState: 'idle', afkMs: 0 }
  )

  defineEmits<{ (event: 'replay'): void; (event: 'retry'): void; (event: 'signin'): void }>()

  const { t } = useI18n()

  const reason = computed(() => {
    if (props.failReason) return `failed · ${props.failReason}`
    return props.summary.mode === 'time'
      ? `time · ${props.summary.amount}s`
      : `words · ${props.summary.amount}`
  })

  // Grade by accuracy (SCORING_CONCEPT §4); SS/S get the main accent color.
  const grade = computed(() => gradeOf(props.metrics.accuracy))
  const isTopGrade = computed(() => grade.value === 'SS' || grade.value === 'S')

  const configLine = computed(() => {
    const s = props.summary
    const mods = [
      s.punctuation && 'punctuation',
      s.numbers && 'numbers',
      s.randomCase && 'random case',
      s.nospace && 'no space'
    ].filter(Boolean)
    const parts = [s.language, s.difficulty, ...mods]
    return parts.join(' · ')
  })

  /**
   * Whole seconds: a sub-second idle gap is noise, not a fact worth a line.
   * The share (idle over the run window) is what makes the number mean
   * something — 9s of afk is a shrug in a 60s run and the whole run in a 10s
   * one. A zero-length window has nothing to divide by, so it keeps the bare
   * seconds rather than printing a fabricated percentage.
   */
  const afkLabel = computed(() => {
    if (props.afkMs <= 0) return ''
    const seconds = Math.round(props.afkMs / 1000)
    const windowMs = props.metrics.durationSec * 1000
    if (!(windowMs > 0)) return t('results.afk', { seconds })
    const percent = Math.round(Math.min(props.afkMs / windowMs, 1) * 100)
    return t('results.afkWithShare', { seconds, percent })
  })
</script>

<style lang="scss" scoped>
  .results {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    margin: 0 auto;

    &__main {
      display: flex;
      gap: 28px;
      align-items: center;
    }

    &__primary {
      display: flex;
      flex: 0 0 auto;
      flex-direction: column;
      gap: 12px;
    }

    &__chart {
      flex: 1 1 auto;
      min-width: 0;
    }

    &__secondary {
      display: flex;
      flex-wrap: wrap;
      gap: 28px;
      align-items: baseline;
    }

    &__metric {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    &__label {
      font-size: 14px;
      color: var(--sub-color);
    }

    &__value {
      font-size: 28px;
      color: var(--main-color);

      &--hero {
        font-size: 56px;
        line-height: 1;
      }

      &--chars {
        font-size: 24px;
        color: var(--text-color);
      }
    }

    &__char {
      &--incorrect,
      &--extra {
        color: var(--error-color);
      }

      &--missed {
        color: var(--sub-color);
      }
    }

    &__score {
      display: flex;
      gap: 20px;
      align-items: center;
      font-variant-numeric: tabular-nums;
    }

    &__grade {
      font-size: 56px;
      font-weight: 700;
      line-height: 1;
      color: var(--sub-color);

      &--top {
        color: var(--main-color);
      }
    }

    &__breakdown {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      font-size: 14px;
      color: var(--sub-color);
    }

    &__score-version {
      opacity: 0.6;
    }

    &__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      font-size: 14px;
      color: var(--sub-color);
    }

    &__reason--fail {
      color: var(--error-color);
    }

    &__errors {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__errors-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__error-word {
      display: flex;
      flex-direction: column;
      padding: 6px 10px;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__error-expected {
      font-size: 14px;
      color: var(--sub-color);
    }

    &__error-typed {
      font-size: 16px;
      color: var(--error-color);
      text-decoration: line-through;
    }

    &__save {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 1.5rem;
      margin-top: 0.5rem;
    }

    &__save-link {
      padding: 0;
      font-size: 14px;
      color: var(--sub-color);
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
      background: none;
      border: none;
      transition: color 0.15s ease;

      &:hover {
        color: var(--text-color);
      }
    }

    &__save-status {
      display: inline-flex;
      gap: 0.75rem;
      align-items: center;
      font-size: 14px;
      color: var(--sub-color);

      &--ok {
        color: var(--main-color);
      }

      &--error {
        color: var(--error-color);
      }
    }

    @media screen and (width <= 700px) {
      &__main {
        flex-direction: column;
        align-items: stretch;
      }

      &__primary {
        flex-direction: row;
        gap: 32px;
        justify-content: center;
      }
    }
  }
</style>
