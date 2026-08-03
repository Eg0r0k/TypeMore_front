<template>
  <div class="flex flex-col gap-3" data-testid="profile-summary">
    <!-- C1 — identity: banner, avatar, name, meta, counters, languages. Its
         own component (`identity.vue`), because the header is a composition of
         half a dozen pieces and the stat grid below is a list of figures. -->
    <ProfileIdentity
      v-if="part !== 'stats'"
      :summary="summary"
      :recent-wpm="recentWpm"
      :own="own"
    />

    <!--
      C2 — THE numbers, as their own block: three columns, one big figure per
      cell, the qualifying detail hanging under it in small type. Reading order
      is by row — the volume counters first, then wpm / raw / acc / consistency,
      each as highest · average · last 10. Nothing is a card and nothing is a
      table: a stat block is a list of figures, and the figures are the design.
    -->
    <div
      v-if="part !== 'identity'"
      class="grid grid-cols-3 gap-x-4 gap-y-4 rounded-lg p-3 sm:p-4"
      data-testid="profile-stats-grid"
    >
      <div v-for="cell in cells" :key="cell.testid" class="min-w-0">
        <div class="text-xs text-sub sm:text-sm">{{ cell.label }}</div>
        <div
          class="text-2xl leading-[1.1] tabular-nums text-text md:text-3xl"
          :data-testid="cell.testid"
        >
          {{ cell.value }}
        </div>
        <div v-if="cell.hint" class="text-xs text-sub" :data-testid="cell.hint.testid">
          {{ cell.hint.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { ProfileMetricStats, ProfileSummary } from '@shared/api'
  import { groupThousands } from '@/shared/lib/helpers/numbers'
  import { formatClock, percent, speed } from '../model/format'
  import ProfileIdentity from './identity.vue'

  /**
   * `part` lets the page place identity and the stat block on opposite sides
   * of the PB cards while both stay fed by the one summary query. Absent, the
   * card renders whole — the shape every existing test mounts.
   *
   * `recentWpm` and `own` belong to the header alone and are forwarded: the
   * sparkline's runs come from the PAGE's feed (own `/runs` or the player's
   * public history), so this component stays fed by the one summary query.
   */
  const props = defineProps<{
    summary: ProfileSummary
    part?: 'identity' | 'stats'
    recentWpm?: readonly number[]
    own?: boolean
  }>()
  const { t } = useI18n()

  interface StatCell {
    label: string
    value: string
    /** The qualifying line under the figure, when the figure needs one. */
    hint?: { text: string; testid: string }
    testid: string
  }

  /**
   * One metric's three figures — highest, average, average of the last 10 — in
   * that order, labelled by composing the metric's name with the aggregate's
   * so a new metric needs no new copy.
   */
  const metricCells = (
    key: 'wpm' | 'raw' | 'acc' | 'consistency',
    stats: ProfileMetricStats,
    asPercent: boolean
  ): StatCell[] =>
    (['highest', 'average', 'averageLast10'] as const).map((aggregate) => ({
      label: t(`profile.statOf.${aggregate}`, { metric: t(`profile.metric.${key}`) }),
      value: asPercent ? percent(stats[aggregate]) : speed(stats[aggregate]),
      testid: `profile-${key}-${aggregate}`
    }))

  const cells = computed<StatCell[]>(() => {
    const { summary } = props
    return [
      {
        label: t('profile.testsStarted'),
        value: groupThousands(summary.testsStarted),
        testid: 'profile-tests-started'
      },
      {
        // The share is part of the figure, not a footnote: "602" alone says
        // nothing about how many were abandoned.
        label: t('profile.testsCompleted'),
        value:
          summary.testsStarted > 0
            ? `${groupThousands(summary.testsCompleted)} (${percent(summary.testsCompleted / summary.testsStarted)})`
            : groupThousands(summary.testsCompleted),
        hint: {
          text: `${summary.restartsPerCompleted.toFixed(1)} ${t('profile.restartsPerCompleted')}`,
          testid: 'profile-restarts'
        },
        testid: 'profile-tests-completed'
      },
      {
        label: t('profile.timeTyping'),
        value: formatClock(summary.timeTypingMs),
        hint: {
          text: `${groupThousands(summary.estimatedWordsTyped)} ${t('profile.wordsTyped')}`,
          testid: 'profile-words-typed'
        },
        testid: 'profile-time-typing'
      },
      ...metricCells('wpm', summary.wpm, false),
      ...metricCells('raw', summary.raw, false),
      ...metricCells('acc', summary.acc, true),
      ...metricCells('consistency', summary.consistency, true)
    ]
  })
</script>
