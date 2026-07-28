<template>
  <main class="profile">
    <!-- Anonymous: the page is a sign-in hint, not a redirect — the URL is
         shareable and the answer to "what is here" is honest. -->
    <section
      v-if="authStore.isResolved && !authed"
      class="profile__signin"
      data-testid="profile-signin-hint"
    >
      <Typography size="m" color="sub">{{ t('profile.signin.hint') }}</Typography>
      <Button color="main-outline" size="s" data-testid="profile-signin-link" @click="toLogin">
        {{ t('profile.signin.action') }}
      </Button>
    </section>

    <template v-else>
      <!-- C1 + C2 — header, counters, stats grid: one summary query. -->
      <ProfileSection
        name="summary"
        :loading="summary.isPending.value"
        :error="summary.isError.value"
        @retry="summary.refetch"
      >
        <ProfileSummaryCard v-if="summary.data.value" :summary="summary.data.value" />
      </ProfileSection>

      <!-- C3 — the activity calendar + streak. -->
      <ProfileSection
        name="activity"
        :title="t('profile.activity.title')"
        :loading="activity.isPending.value"
        :error="activity.isError.value"
        @retry="activity.refetch"
      >
        <ProfileActivity
          v-if="activity.data.value"
          :activity="activity.data.value"
          :streak="summary.data.value?.streak ?? { current: 0, best: 0 }"
        />
      </ProfileSection>

      <!-- C4 — PB cards, with the race action wired to the home race flow. -->
      <ProfileSection
        name="pbs"
        :title="t('profile.pbs.title')"
        :loading="pbs.isPending.value"
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

      <!-- C5 — the two charts. The daily chart owns the range presets and the
           two toggles; the header stat is the SERVER's regression. -->
      <ProfileSection
        name="charts"
        :title="t('profile.charts.title')"
        :loading="timeseries.isPending.value"
        :error="timeseries.isError.value"
        @retry="timeseries.refetch"
      >
        <template #head>
          <div class="profile__chart-controls">
            <ToggleGroup
              :model-value="range"
              type="single"
              :aria-label="t('profile.charts.range')"
              @update:model-value="onRange"
            >
              <ToggleGroupItem
                v-for="preset in RANGE_PRESETS"
                :key="preset"
                :value="preset"
                :data-testid="`profile-range-${preset}`"
              >
                {{ t(`profile.charts.rangePreset.${preset}`) }}
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              :model-value="metric"
              type="single"
              :aria-label="t('profile.charts.metric')"
              @update:model-value="onMetric"
            >
              <ToggleGroupItem value="speed" data-testid="profile-metric-speed">
                {{ t('profile.charts.speed') }}
              </ToggleGroupItem>
              <ToggleGroupItem value="accuracy" data-testid="profile-metric-accuracy">
                {{ t('profile.charts.accuracy') }}
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              :model-value="String(smoothing)"
              type="single"
              :aria-label="t('profile.charts.smoothing')"
              @update:model-value="onSmoothing"
            >
              <ToggleGroupItem value="10" data-testid="profile-smoothing-10">
                {{ t('profile.charts.avgOf', { n: 10 }) }}
              </ToggleGroupItem>
              <ToggleGroupItem value="100" data-testid="profile-smoothing-100">
                {{ t('profile.charts.avgOf', { n: 100 }) }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </template>

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

        <div class="profile__hist">
          <Typography size="s" color="sub">{{ t('profile.charts.histogramTitle') }}</Typography>
          <ProfileHistogram v-if="histogram.data.value" :histogram="histogram.data.value" />
          <div v-if="histogram.isError.value" class="profile__hist-error">
            <Typography size="s" color="error">{{ t('profile.sectionError') }}</Typography>
            <Button color="main-outline" size="s" @click="histogram.refetch">
              {{ t('profile.retry') }}
            </Button>
          </div>
        </div>
      </ProfileSection>

      <!-- C9 — the keyboard heatmap. -->
      <ProfileSection
        name="keyboard"
        :title="t('profile.keyboard.title')"
        :loading="keyboard.isPending.value || layouts.isPending.value"
        :error="keyboard.isError.value || layouts.isError.value"
        @retry="retryKeyboard"
      >
        <ProfileKeyboard
          v-if="keyboard.data.value && layouts.data.value"
          :keyboard="keyboard.data.value"
          :layouts="layouts.data.value.layouts"
        />
      </ProfileSection>

      <!-- The runs table (its own keyset pagination and error handling). -->
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
    keyboardLayoutsQueryOptions,
    profileActivityQueryOptions,
    profileHistogramQueryOptions,
    profileKeyboardQueryOptions,
    profilePBsQueryOptions,
    profileSummaryQueryOptions,
    profileTimeseriesQueryOptions
  } from '@shared/api'
  import { useAuthStore } from '@/entities/auth'
  import {
    ProfileActivity,
    ProfileDailyChart,
    ProfileHistogram,
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
  import { isoDaysAgo } from '@/features/profile/model/format'

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
  const activity = useQuery(computed(() => gatedBy(profileActivityQueryOptions(), authed.value)))
  const pbs = useQuery(computed(() => gatedBy(profilePBsQueryOptions(), authed.value)))
  const histogram = useQuery(computed(() => gatedBy(profileHistogramQueryOptions(), authed.value)))
  const keyboard = useQuery(computed(() => gatedBy(profileKeyboardQueryOptions(), authed.value)))
  const layouts = useQuery(computed(() => gatedBy(keyboardLayoutsQueryOptions(), authed.value)))

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

  const retryKeyboard = (): void => {
    if (keyboard.isError.value) void keyboard.refetch()
    if (layouts.isError.value) void layouts.refetch()
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const toLogin = (): void => void router.push(routeLocation.login())
  /** Every race entry point goes through /race/{id} — one application path. */
  const toRace = (runId: string): void =>
    void router.push({ name: ROUTE_NAMES.RACE, params: { runId } })
  const toReplay = (runId: string): void =>
    void router.push({ name: ROUTE_NAMES.REPLAY, params: { runId } })
</script>

<style lang="scss" scoped>
  .profile {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 100%;
    padding: 1.25rem 0 3rem;

    &__signin {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
      padding: 2rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__chart-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    &__hist {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    &__hist-error {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
  }
</style>
