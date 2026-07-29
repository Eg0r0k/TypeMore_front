<template>
  <div v-if="pbs.length === 0" class="pf-pbs__empty" data-testid="profile-pbs-empty">
    <Typography size="s" color="sub">{{ t('profile.pbs.empty') }}</Typography>
  </div>

  <ul v-else class="pf-pbs" data-testid="profile-pbs">
    <li
      v-for="pb in pbs"
      :key="pb.bucket"
      class="pf-pbs__card"
      :data-testid="`profile-pb-${pb.bucket}`"
    >
      <div class="pf-pbs__label">
        <Typography size="s" color="primary">{{ bucketLabel(pb) }}</Typography>
        <Typography v-if="pb.source" size="xs" color="sub">{{ pb.source }}</Typography>
      </div>

      <dl class="pf-pbs__stats">
        <div>
          <dt>{{ t('profile.pbs.score') }}</dt>
          <dd>{{ grouped(pb.score) }}</dd>
        </div>
        <div>
          <dt>wpm</dt>
          <dd>{{ speed(pb.wpm) }}</dd>
        </div>
        <div>
          <dt>acc</dt>
          <dd>{{ percent(pb.acc) }}</dd>
        </div>
        <div>
          <dt>{{ pb.grade }}</dt>
          <dd class="pf-pbs__date">{{ formatShortDate(pb.achievedAt, locale) }}</dd>
        </div>
      </dl>

      <div class="pf-pbs__actions">
        <!-- "race your PB" — the profile's killer button (C10 item 10). -->
        <Button
          color="main-outline"
          size="s"
          :data-testid="`profile-pb-race-${pb.bucket}`"
          @click="$emit('race', pb.runId)"
        >
          {{ t('profile.pbs.race') }}
        </Button>
        <Button color="shadow" size="s" @click="$emit('watch', pb.runId)">
          {{ t('profile.pbs.watch') }}
        </Button>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  import type { ProfilePB } from '@shared/api'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { grouped, percent, speed } from '../model/format'

  /** PB cards from /profile/pbs — the leaderboard entries, decorated. */
  defineProps<{ pbs: readonly ProfilePB[] }>()
  defineEmits<{ race: [runId: string]; watch: [runId: string] }>()
  const { t, locale } = useI18n()

  /** `time:15000` → `time 15s`, `words:50` → `50 words`, quotes by their source. */
  const bucketLabel = (pb: ProfilePB): string => {
    if (pb.quoteId) return t('profile.pbs.quote')
    if (pb.mode === 'time' && pb.durationMs) return `time ${pb.durationMs / 1000}s · ${pb.lang}`
    if (pb.mode === 'words' && pb.wordCount) return `${pb.wordCount} words · ${pb.lang}`
    return pb.bucket
  }
</script>

<style lang="scss" scoped>
  .pf-pbs {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;

    &__card {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      padding: 0.875rem 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__label {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    &__stats {
      display: flex;
      gap: 1.25rem;
      margin: 0;

      dt {
        font-size: 0.6875rem;
        color: var(--sub-color);
      }

      dd {
        margin: 0;
        font-size: 1.0625rem;
        font-variant-numeric: tabular-nums;
        color: var(--text-color);
      }
    }

    &__date {
      font-size: 0.75rem !important;
      color: var(--sub-color) !important;
    }

    &__actions {
      display: flex;
      gap: 0.5rem;
    }

    &__empty {
      padding: 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
