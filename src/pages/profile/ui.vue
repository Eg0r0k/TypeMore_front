<template>
  <main class="flex w-full min-w-0 flex-col gap-6 pb-12 pt-5 sm:gap-8">
    <!--
      `min-w-0` is load-bearing, not decoration. The app shell's `#main` is a GRID
      (the global `main { display: grid }` rule), so this page is a grid item, and
      a grid item defaults to `min-width: auto` — it may not shrink below its own
      min-content. The calendar and the keyboard are ~680 px of min-content, so
      the column sized itself to THEM: the page laid out 677 px wide inside a
      328 px shell, every `overflow-x-auto` inside had nothing to scroll against,
      and the charts measured 677 and drew at 677. Allowing the item to shrink is
      what makes all of the responsive work below actually take effect.
    -->
    <!-- Anonymous: the page is a sign-in hint, not a redirect — the URL is
         shareable and the answer to "what is here" is honest. -->
    <section
      v-if="authStore.isResolved && !authed"
      class="flex flex-col items-start gap-4 rounded-lg bg-sub-alt p-6 sm:p-8"
      data-testid="profile-signin-hint"
    >
      <Typography size="m" color="sub">{{ t('profile.signin.hint') }}</Typography>
      <Button color="main-outline" size="s" data-testid="profile-signin-link" @click="toLogin">
        {{ t('profile.signin.action') }}
      </Button>
    </section>

    <template v-else>
      <!--
        Reading order, top to bottom: identity → activity → personal bests →
        statistics → progress → keyboard → tests. The run history (and its
        replays) closes the page by request; everything above it is the
        "my progress" read.
      -->
      <!-- C1 — identity header; the stat block renders after the PBs, both
           off the ONE summary query. -->
      <ProfileSection
        name="summary"
        :loading="summary.isPending.value"
        :busy="isBusy(summary)"
        :error="summary.isError.value"
        @retry="summary.refetch"
      >
        <!-- The header has a shape worth reserving, so it brings its own
             skeleton instead of the section's plain block. -->
        <template #skeleton><ProfileIdentitySkeleton /></template>
        <!-- The owner sees their own identity half too, and that is the
             point: it is the only place they can check what a visitor gets
             without opening their own public page. The source is
             `/me/profile` rather than the public header — the owner's route
             answers whatever their privacy switches say, so a closed profile
             still shows its owner what is stored. -->
        <ProfileSummaryCard
          v-if="summary.data.value"
          :summary="summary.data.value"
          part="identity"
          :recent-wpm="recentWpm"
          own
          :bio="ownProfile.data.value?.bio"
          :keyboard="ownProfile.data.value?.keyboard"
          :links="ownProfile.data.value?.links"
          :badges="shownBadgeCodes"
          :share-name="summary.data.value.displayName"
        />
      </ProfileSection>

      <!-- C3 — the activity calendar (the streak line lives on the card above). -->
      <ProfileSection
        name="activity"
        :title="t('profile.activity.title')"
        :loading="activity.isPending.value"
        :busy="isBusy(activity)"
        :error="activity.isError.value"
        @retry="activity.refetch"
      >
        <ProfileActivity v-if="activity.data.value" :activity="activity.data.value" />
      </ProfileSection>

      <!-- C4 — PB cards, with the race action wired to the home race flow. -->
      <ProfileSection
        name="pbs"
        :title="t('profile.pbs.title')"
        :loading="pbs.isPending.value"
        :busy="isBusy(pbs)"
        :error="pbs.isError.value"
        @retry="pbs.refetch"
      >
        <ProfilePBCards
          v-if="pbs.data.value"
          :pbs="pbs.data.value.pbs"
          @race="toRace"
          @watch="toReplay"
        />
      </ProfileSection>

      <!-- C2 — the summary numbers, right under the records they qualify. -->
      <ProfileSection
        name="stats"
        :title="t('profile.statsTitle')"
        :loading="summary.isPending.value"
        :busy="isBusy(summary)"
        :error="summary.isError.value"
        @retry="summary.refetch"
      >
        <ProfileSummaryCard v-if="summary.data.value" :summary="summary.data.value" part="stats" />
      </ProfileSection>

      <!-- C5 — the two charts. The daily chart owns the range presets and the
           two toggles; the header stat is the SERVER's regression. A range
           switch keeps the previous range on screen (keepPreviousData) and only
           dims the section, so the chart is never torn down and rebuilt. -->
      <ProfileSection
        name="charts"
        :title="t('profile.charts.title')"
        :loading="timeseries.isPending.value"
        :busy="isBusy(timeseries)"
        :error="timeseries.isError.value"
        @retry="timeseries.refetch"
      >
        <template #head>
          <div class="flex flex-wrap gap-1.5 sm:gap-2">
            <ToggleGroup
              :model-value="range"
              type="single"
              size="sm"
              :aria-label="t('profile.charts.range')"
              @update:model-value="onRange"
            >
              <ToggleGroupItem
                v-for="preset in RANGE_PRESETS"
                :key="preset"
                :value="preset"
                class="text-xs"
                :data-testid="`profile-range-${preset}`"
              >
                {{ t(`profile.charts.rangePreset.${preset}`) }}
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              :model-value="metric"
              type="single"
              size="sm"
              :aria-label="t('profile.charts.metric')"
              @update:model-value="onMetric"
            >
              <ToggleGroupItem value="speed" class="text-xs" data-testid="profile-metric-speed">
                {{ t('profile.charts.speed') }}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="accuracy"
                class="text-xs"
                data-testid="profile-metric-accuracy"
              >
                {{ t('profile.charts.accuracy') }}
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              :model-value="String(smoothing)"
              type="single"
              size="sm"
              :aria-label="t('profile.charts.smoothing')"
              @update:model-value="onSmoothing"
            >
              <ToggleGroupItem value="10" class="text-xs" data-testid="profile-smoothing-10">
                {{ t('profile.charts.avgOf', { n: 10 }) }}
              </ToggleGroupItem>
              <ToggleGroupItem value="100" class="text-xs" data-testid="profile-smoothing-100">
                {{ t('profile.charts.avgOf', { n: 100 }) }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </template>

        <div class="flex flex-col gap-4">
          <template v-if="timeseries.data.value">
            <!-- The header stat: computed server-side (OLS of wpm over
                 cumulative hours in range — docs/PROFILE.md). -->
            <Typography size="s" color="sub" data-testid="profile-wpm-per-hour">
              {{
                t('profile.charts.perHour', {
                  delta: `${timeseries.data.value.wpmPerHour >= 0 ? '+' : ''}${timeseries.data.value.wpmPerHour.toFixed(1)}`
                })
              }}
            </Typography>
            <ProfileDailyChart
              :timeseries="timeseries.data.value"
              :metric="metric"
              :smoothing="smoothing"
            />
          </template>

          <div class="relative flex flex-col gap-2">
            <Typography size="s" color="sub">{{ t('profile.charts.histogramTitle') }}</Typography>
            <div
              v-if="histogram.isPending.value"
              class="min-h-32 animate-pulse rounded-lg bg-sub-alt"
              data-testid="profile-loading-histogram"
              aria-hidden="true"
            />
            <ProfileHistogram v-else-if="histogram.data.value" :histogram="histogram.data.value" />
            <div
              v-if="histogram.isError.value"
              role="status"
              class="flex flex-wrap items-center gap-4"
            >
              <Typography size="s" color="error">{{ t('profile.sectionError') }}</Typography>
              <Button color="main-outline" size="s" @click="histogram.refetch">
                {{ t('profile.retry') }}
              </Button>
            </div>
          </div>
        </div>
      </ProfileSection>

      <!-- C9 — the keyboard heatmap over the local layout presets. -->
      <ProfileSection
        name="keyboard"
        :title="t('profile.keyboard.title')"
        :loading="keyboard.isPending.value"
        :busy="isBusy(keyboard)"
        :error="keyboard.isError.value"
        @retry="keyboard.refetch"
      >
        <ProfileKeyboard v-if="keyboard.data.value" :keyboard="keyboard.data.value" />
      </ProfileSection>

      <!-- The runs table closes the page (its own keyset pagination and
           error handling) — the replays live at the very bottom by request. -->
      <ProfileSection name="runs" :title="t('profile.runs.title')">
        <ProfileRunsTable @race="toRace" @watch="toReplay" />
      </ProfileSection>
    </template>
  </main>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  import {
    profileActivityQueryOptions,
    profileHistogramQueryOptions,
    profileKeyboardQueryOptions,
    profilePBsQueryOptions,
    ownProfileQueryOptions,
    profileSummaryQueryOptions,
    profileTimeseriesQueryOptions,
    runsQueryOptions
  } from '@shared/api'
  import { useAuthStore } from '@/entities/auth'
  import {
    ProfileActivity,
    ProfileDailyChart,
    ProfileHistogram,
    ProfileIdentitySkeleton,
    ProfileKeyboard,
    ProfilePBCards,
    ProfileRunsTable,
    ProfileSection,
    ProfileSummaryCard
  } from '@/features/profile'
  import { narrowTo } from '@/shared/lib/helpers/narrow'
  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import { isoDaysAgo, wpmSeries } from '@/features/profile/model/format'

  /**
   * /profile — the statistics surface (backend docs/PROFILE.md). Every section
   * is its own query behind its own ProfileSection chrome, so one failed
   * aggregate is one grey card with a retry, never a blank page; a fresh
   * account renders honest zeroes and empty states throughout.
   */
  const { t } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()
  const authed = computed(() => authStore.isAuth)

  /** Options + the auth gate, shaped the way use-replay-source gates its pair. */
  const gatedBy = <T extends object>(options: T, enabled: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled
  })
  const summary = useQuery(computed(() => gatedBy(profileSummaryQueryOptions(), authed.value)))

  /**
   * The owner's own identity half. A separate query from the summary because
   * it is a separate route with a separate cache entry — the settings dialog
   * writes it, and the header re-renders from the same entry the moment it
   * does, with nothing here to invalidate.
   *
   * Only the SHOWN badges reach the header: the pool includes ones held but
   * hidden, and the owner's page must show what a visitor sees, not what the
   * settings screen offers to arrange.
   */
  const ownProfile = useQuery(computed(() => gatedBy(ownProfileQueryOptions(), authed.value)))
  const shownBadgeCodes = computed(() =>
    (ownProfile.data.value?.badges ?? [])
      .filter((badge) => badge.shown)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((badge) => badge.code)
  )
  const activity = useQuery(computed(() => gatedBy(profileActivityQueryOptions(), authed.value)))
  const pbs = useQuery(computed(() => gatedBy(profilePBsQueryOptions(), authed.value)))
  const histogram = useQuery(computed(() => gatedBy(profileHistogramQueryOptions(), authed.value)))
  const keyboard = useQuery(computed(() => gatedBy(profileKeyboardQueryOptions(), authed.value)))

  /**
   * The header's sparkline. Its own page of the run feed — longer than the
   * table's default page, because the line is about the recent SHAPE and a
   * dozen points barely have one. Nothing else on the page reads it.
   */
  const SPARKLINE_RUNS = 30
  const recentRuns = useQuery(
    computed(() => gatedBy(runsQueryOptions(undefined, SPARKLINE_RUNS), authed.value))
  )
  const recentWpm = computed(() => wpmSeries(recentRuns.data.value?.runs, SPARKLINE_RUNS))

  // ── The range presets: all time / 3 months / month / week / day ────────────
  const RANGE_PRESETS = ['all', '3mo', 'month', 'week', 'day'] as const
  type RangePreset = (typeof RANGE_PRESETS)[number]
  const RANGE_DAYS: Record<Exclude<RangePreset, 'all'>, number> = {
    '3mo': 92,
    month: 31,
    week: 7,
    day: 1
  }
  const range = ref<RangePreset>('all')
  const from = computed(() =>
    range.value === 'all' ? undefined : isoDaysAgo(RANGE_DAYS[range.value])
  )
  const timeseries = useQuery(
    computed(() => gatedBy(profileTimeseriesQueryOptions(from.value), authed.value))
  )

  /**
   * "Busy" is every load that is NOT the first one: there is data on screen, so
   * the section dims and floats a spinner instead of tearing its content down.
   */
  const isBusy = (query: {
    isFetching: { value: boolean }
    isPending: { value: boolean }
  }): boolean => query.isFetching.value && !query.isPending.value

  const metric = ref<'speed' | 'accuracy'>('speed')
  const smoothing = ref(10)

  const onRange = (value: unknown): void => {
    const preset = narrowTo(RANGE_PRESETS, value)
    if (preset !== null) range.value = preset
  }
  const onMetric = (value: unknown): void => {
    if (value === 'speed' || value === 'accuracy') metric.value = value
  }
  const onSmoothing = (value: unknown): void => {
    if (value === '10' || value === '100') smoothing.value = Number(value)
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const toLogin = (): void => void router.push(routeLocation.login())
  /** Every race entry point goes through /race/{id} — one application path. */
  const toRace = (runId: string): void =>
    void router.push({ name: ROUTE_NAMES.RACE, params: { runId } })
  const toReplay = (runId: string): void =>
    void router.push({ name: ROUTE_NAMES.REPLAY, params: { runId } })
</script>
