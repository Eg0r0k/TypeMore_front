<template>
  <div
    v-if="pbs.length === 0"
    class="rounded-lg bg-sub-alt px-4 py-3"
    data-testid="profile-pbs-empty"
  >
    <Typography size="s" color="sub">{{ t('profile.pbs.empty') }}</Typography>
  </div>

  <ul
    v-else
    class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 p-0"
    data-testid="profile-pbs"
  >
    <li
      v-for="pb in pbs"
      :key="pb.bucket"
      class="flex flex-col gap-1.5 rounded-md bg-sub-alt px-3 py-2.5"
      :data-testid="`profile-pb-${pb.bucket}`"
    >
      <!-- What this record IS (the bucket), with the grade as a quiet badge —
           one hero number per card, and that number is the wpm below. -->
      <div class="flex items-center justify-between gap-1.5">
        <span class="truncate text-[11px] text-sub" :title="bucketLabel(pb)">
          {{ bucketLabel(pb) }}
        </span>
        <span
          class="shrink-0 rounded bg-bg px-1.5 py-0.5 text-xs font-semibold leading-none text-main"
        >
          {{ pb.grade }}
        </span>
      </div>

      <div class="flex items-baseline gap-1">
        <span class="text-2xl leading-none tabular-nums text-text">{{ speed(pb.wpm) }}</span>
        <span class="text-[10px] text-sub">wpm</span>
        <span class="ml-auto text-[11px] tabular-nums text-sub">{{ percent(pb.acc) }}</span>
      </div>

      <div class="flex items-center justify-between gap-1">
        <span
          class="truncate text-[10px] tabular-nums text-sub"
          :title="`${t('profile.pbs.score')} ${grouped(pb.score)} · ${formatShortDate(pb.achievedAt, locale)}`"
        >
          {{ grouped(pb.score) }} · {{ formatShortDate(pb.achievedAt, locale) }}
        </span>

        <!-- The app's one action pair, in the app's one icon-button size —
               the words live in title/aria-label, so the card stays small. -->
        <div class="flex shrink-0 gap-0.5">
          <Button
            color="shadow"
            size="icon-sm"
            :title="t('profile.pbs.race')"
            :aria-label="t('profile.pbs.race')"
            :data-testid="`profile-pb-race-${pb.bucket}`"
            @click="$emit('race', pb.runId)"
          >
            <IconRace />
          </Button>
          <Button
            color="shadow"
            size="icon-sm"
            :title="t('profile.pbs.watch')"
            :aria-label="t('profile.pbs.watch')"
            :data-testid="`profile-pb-watch-${pb.bucket}`"
            @click="$emit('watch', pb.runId)"
          >
            <IconWatch />
          </Button>
        </div>
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
  import IconRace from '~icons/tabler/swords'
  import IconWatch from '~icons/tabler/eye'
  import { grouped, percent, speed } from '../model/format'

  /**
   * PB cards from /profile/pbs — the leaderboard entries, decorated. Deliberately
   * SMALL: a personal best is a glance ("time 15s · 103 wpm, SS"), not a report,
   * so a full board of buckets fits one screen instead of a column of banners.
   */
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
