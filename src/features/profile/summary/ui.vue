<template>
  <div class="pf-summary p-4" data-testid="profile-summary">
    <!-- C1 — identity + the counters row. -->
    <header class="pf-summary__header">
      <div>
        <Typography tag-name="h1" size="l" color="primary" data-testid="profile-nick">
          {{ summary.displayName }}
        </Typography>
        <Typography size="xs" color="sub" data-testid="profile-joined">
          {{ t('profile.joined', { date: joinedDate }) }}
        </Typography>
      </div>
      <div
        v-if="summary.languages.length > 0"
        class="pf-summary__langs"
        data-testid="profile-languages"
      >
        <span
          v-for="entry in summary.languages.slice(0, 4)"
          :key="entry.lang"
          class="pf-summary__lang"
        >
          {{ entry.lang }} · {{ grouped(entry.tests) }}
        </span>
      </div>
    </header>

    <dl class="pf-summary__counters">
      <div class="pf-summary__stat" data-testid="profile-tests-started">
        <dt>{{ t('profile.testsStarted') }}</dt>
        <dd>{{ grouped(summary.testsStarted) }}</dd>
      </div>
      <div class="pf-summary__stat" data-testid="profile-tests-completed">
        <dt>{{ t('profile.testsCompleted') }}</dt>
        <dd>
          {{ grouped(summary.testsCompleted) }}
          <span v-if="summary.testsStarted > 0" class="pf-summary__sub">
            ({{ percent(summary.testsCompleted / summary.testsStarted) }})
          </span>
        </dd>
      </div>
      <div class="pf-summary__stat" data-testid="profile-restarts">
        <dt>{{ t('profile.restartsPerCompleted') }}</dt>
        <dd>{{ summary.restartsPerCompleted.toFixed(1) }}</dd>
      </div>
      <div class="pf-summary__stat" data-testid="profile-time-typing">
        <dt>{{ t('profile.timeTyping') }}</dt>
        <dd>{{ formatDuration(summary.timeTypingMs) }}</dd>
      </div>
      <div class="pf-summary__stat" data-testid="profile-words-typed">
        <dt>{{ t('profile.wordsTyped') }}</dt>
        <dd>{{ grouped(summary.estimatedWordsTyped) }}</dd>
      </div>
    </dl>

    <!-- C2 — the stats grid: four metric groups × highest / average / last 10. -->
    <div class="pf-summary__grid" data-testid="profile-stats-grid">
      <div v-for="group in groups" :key="group.key" class="pf-summary__group">
        <Typography size="xs" color="sub">{{ t(`profile.metric.${group.key}`) }}</Typography>
        <dl>
          <div v-for="cell in group.cells" :key="cell.key" class="pf-summary__cell">
            <dt>{{ t(`profile.stat.${cell.key}`) }}</dt>
            <dd :data-testid="`profile-${group.key}-${cell.key}`">{{ cell.value }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { ProfileMetricStats, ProfileSummary } from '@shared/api'
  import { Typography } from '@/shared/ui/typography'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { formatDuration, grouped, percent, speed } from '../model/format'

  const props = defineProps<{ summary: ProfileSummary }>()
  const { t, locale } = useI18n()

  const joinedDate = computed(() => formatShortDate(props.summary.joined, locale.value))

  /** wpm/raw render at one decimal; acc/consistency are [0, 1] → percent. */
  const cellsOf = (stats: ProfileMetricStats, asPercent: boolean) =>
    (['highest', 'average', 'averageLast10'] as const).map((key) => ({
      key,
      value: asPercent ? percent(stats[key]) : speed(stats[key])
    }))

  const groups = computed(() => [
    { key: 'wpm', cells: cellsOf(props.summary.wpm, false) },
    { key: 'raw', cells: cellsOf(props.summary.raw, false) },
    { key: 'acc', cells: cellsOf(props.summary.acc, true) },
    { key: 'consistency', cells: cellsOf(props.summary.consistency, true) }
  ])
</script>

<style lang="scss" scoped>
  .pf-summary {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__header {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
    }

    &__langs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    &__lang {
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      color: var(--sub-color);
      background-color: var(--bg-color);
      border-radius: var(--border-radius);
    }

    &__counters {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem 2.5rem;
      margin: 0;
    }

    &__stat {
      dt {
        font-size: 0.75rem;
        color: var(--sub-color);
      }

      dd {
        margin: 0;
        font-size: 1.5rem;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
        color: var(--text-color);
      }
    }

    &__sub {
      font-size: 0.875rem;
      color: var(--sub-color);
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 1rem;
    }

    &__group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.75rem 1rem;
      background-color: var(--bg-color);
      border-radius: var(--border-radius);

      dl {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0;
      }
    }

    &__cell {
      display: flex;
      align-items: baseline;
      justify-content: space-between;

      dt {
        font-size: 0.75rem;
        color: var(--sub-color);
      }

      dd {
        margin: 0;
        font-size: 1rem;
        font-variant-numeric: tabular-nums;
        color: var(--text-color);
      }
    }
  }
</style>
