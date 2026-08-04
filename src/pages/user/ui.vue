<template>
  <main class="flex w-full min-w-0 flex-col gap-6 pb-12 pt-5 sm:gap-8">
    <!-- min-w-0: the app shell's #main is a grid, and a grid item may not
         shrink below min-content without it — same trap /profile documents. -->

    <!-- Resolving the name. -->
    <div
      v-if="header.isPending.value"
      class="min-h-24 animate-pulse rounded-lg bg-sub-alt"
      data-testid="user-loading"
      aria-hidden="true"
    />

    <!-- Unknown name: a plain 404 state (names are public on every board, so
         there is nothing to blur — but a closed profile is NOT this state). -->
    <section
      v-else-if="notFound"
      class="flex flex-col items-start gap-4 rounded-lg bg-sub-alt p-6 sm:p-8"
      data-testid="user-not-found"
    >
      <Typography size="m" color="sub">{{ t('user.notFound', { name }) }}</Typography>
      <Button color="main-outline" size="s" @click="toHome">{{ t('user.goHome') }}</Button>
    </section>

    <!-- Any other header failure. -->
    <section
      v-else-if="header.isError.value"
      role="status"
      class="flex flex-wrap items-center gap-4 rounded-lg bg-sub-alt p-4"
      data-testid="user-error"
    >
      <Typography size="s" color="error">{{ t('profile.sectionError') }}</Typography>
      <Button color="main-outline" size="s" @click="header.refetch">
        {{ t('profile.retry') }}
      </Button>
    </section>

    <!-- Closed profile: identity plus the explicit state — the page is real,
         the data is refused BY THE SERVER (403 profile_closed per section).
         Deliberately no data section renders here, not because the client
         hides them but because it does not ask. -->
    <section
      v-else-if="closed"
      class="flex items-center gap-3 rounded-lg bg-sub-alt p-6 sm:p-8"
      data-testid="user-closed"
    >
      <!-- The header payload is all a closed profile answers with, so this is
           the whole page's picture of the person: name and face. -->
      <!-- `bg-bg`: this card is itself a sub-alt panel, and the avatar's own
           surface would otherwise be the same colour as the thing behind it. -->
      <UserAvatar
        :name="header.data.value?.name"
        :src="header.data.value?.avatarUrl"
        class="size-12 bg-bg sm:size-14"
      />
      <div class="flex min-w-0 flex-col gap-1">
        <Typography
          class="truncate font-semibold"
          tag-name="h1"
          size="l"
          color="primary"
          :title="header.data.value?.name"
          data-testid="user-closed-nick"
        >
          {{ header.data.value?.name }}
        </Typography>
        <div class="flex items-center gap-1.5 text-sub">
          <IconLock class="size-4 shrink-0" aria-hidden="true" />
          <Typography size="s" color="sub">{{ t('user.closed') }}</Typography>
        </div>
      </div>
    </section>

    <!-- Open (or own) profile: the /profile sections, read-only. -->
    <template v-else-if="header.data.value">
      <ProfileSection
        name="summary"
        :loading="summary.isPending.value"
        :error="summary.isError.value"
        @retry="summary.refetch"
      >
        <template #skeleton><ProfileIdentitySkeleton /></template>
        <!-- No action in the header here: this is somebody's page as a reader
             sees it, and the only action /profile offers is the viewer's own
             settings. -->
        <ProfileSummaryCard
          v-if="summary.data.value"
          :summary="summary.data.value"
          part="identity"
          :recent-wpm="recentWpm"
        />
        <!-- The self-described half, under the identity block it belongs to.
             Rendered from what the SERVER served: a closed profile never
             carries these, so there is nothing here to hide client-side. -->
        <div class="mt-3 flex items-start justify-between gap-3">
          <ProfileIdentity
            :bio="header.data.value?.bio"
            :keyboard="header.data.value?.keyboard"
            :links="header.data.value?.links"
            :badges="header.data.value?.badges"
          />
          <ProfileCopyLink v-if="header.data.value" :name="header.data.value.name" />
        </div>
      </ProfileSection>

      <ProfileSection
        name="activity"
        :title="t('profile.activity.title')"
        :loading="activity.isPending.value"
        :error="activity.isError.value"
        @retry="activity.refetch"
      >
        <ProfileActivity v-if="activity.data.value" :activity="activity.data.value" />
      </ProfileSection>

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
          readonly
          @watch="toReplay"
        />
      </ProfileSection>

      <ProfileSection
        name="stats"
        :title="t('profile.statsTitle')"
        :loading="summary.isPending.value"
        :error="summary.isError.value"
        @retry="summary.refetch"
      >
        <ProfileSummaryCard v-if="summary.data.value" :summary="summary.data.value" part="stats" />
      </ProfileSection>

      <ProfileSection
        name="charts"
        :title="t('profile.charts.title')"
        :loading="timeseries.isPending.value"
        :error="timeseries.isError.value"
        @retry="timeseries.refetch"
      >
        <div class="flex flex-col gap-4">
          <template v-if="timeseries.data.value">
            <Typography size="s" color="sub" data-testid="profile-wpm-per-hour">
              {{
                t('profile.charts.perHour', {
                  delta: `${timeseries.data.value.wpmPerHour >= 0 ? '+' : ''}${timeseries.data.value.wpmPerHour.toFixed(1)}`
                })
              }}
            </Typography>
            <ProfileDailyChart :timeseries="timeseries.data.value" metric="speed" :smoothing="10" />
          </template>

          <div class="relative flex flex-col gap-2">
            <Typography size="s" color="sub">{{ t('profile.charts.histogramTitle') }}</Typography>
            <div
              v-if="histogram.isPending.value"
              class="min-h-32 animate-pulse rounded-lg bg-sub-alt"
              aria-hidden="true"
            />
            <ProfileHistogram v-else-if="histogram.data.value" :histogram="histogram.data.value" />
          </div>
        </div>
      </ProfileSection>

      <!-- The keyboard portrait: rendered from the server's ANSWER. A 403
           portrait_closed is a state ("its owner keeps it private"), never a
           client-side guess about the owner's switches. -->
      <ProfileSection
        name="keyboard"
        :title="t('profile.keyboard.title')"
        :loading="portrait.isPending.value"
        :error="portraitFailed"
        @retry="portrait.refetch"
      >
        <ProfileKeyboard v-if="portrait.data.value" :keyboard="portrait.data.value" />
        <div
          v-else-if="portraitClosed"
          class="flex items-center gap-2 rounded-lg bg-sub-alt p-4"
          data-testid="user-portrait-closed"
        >
          <IconLock class="size-4 shrink-0 text-sub" aria-hidden="true" />
          <Typography size="s" color="sub">{{ t('user.portraitClosed') }}</Typography>
        </div>
      </ProfileSection>

      <ProfileSection name="runs" :title="t('profile.runs.title')">
        <ProfileRunsTable :user="name" readonly @watch="toReplay" />
      </ProfileSection>
    </template>
  </main>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import IconLock from '~icons/tabler/lock'

  import {
    isApiError,
    meQueryOptions,
    publicProfileActivityQueryOptions,
    publicProfileHistogramQueryOptions,
    publicProfilePBsQueryOptions,
    publicProfilePortraitQueryOptions,
    publicProfileQueryOptions,
    publicProfileRunsQueryOptions,
    publicProfileSummaryQueryOptions,
    publicProfileTimeseriesQueryOptions
  } from '@shared/api'
  import { useAuthStore } from '@/entities/auth'
  import {
    ProfileActivity,
    ProfileCopyLink,
    ProfileDailyChart,
    ProfileHistogram,
    ProfileIdentity,
    ProfileIdentitySkeleton,
    ProfileKeyboard,
    ProfilePBCards,
    ProfileRunsTable,
    ProfileSection,
    ProfileSummaryCard
  } from '@/features/profile'
  import { wpmSeries } from '@/features/profile/model/format'
  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import { UserAvatar } from '@/shared/ui/avatar'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * /u/{name} — another player's profile, read-only (backend docs/PROFILE.md,
   * "Public profiles"). The page reuses the /profile components over the
   * public queries and renders the server's refusals as states:
   *
   *   - unknown name        → the 404 state;
   *   - closed profile      → nick + avatar + "profile closed" (the page is
   *                           real; the client does not even ask for data);
   *   - portrait_closed     → one section's "kept private" note;
   *   - open                → the sections, with no race actions and no
   *                           own-only widgets.
   *
   * Nothing here filters "by guess": what a stranger may see is decided by the
   * server per request, and the owner previewing their own closed page works
   * because the SERVER recognises the session, not because the client special-
   * cases it.
   */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  const name = computed(() => String(route.params.name ?? ''))

  const header = useQuery(computed(() => publicProfileQueryOptions(name.value)))

  const notFound = computed(
    () =>
      header.isError.value && isApiError(header.error.value) && header.error.value.status === 404
  )

  /**
   * The own-profile check, for the PREVIEW case only: the server lets the
   * owner through a closed profile, so the client keeps asking for data when
   * the viewer is the profile's owner. Display names are citext-unique, so a
   * case-insensitive comparison mirrors the server's own resolution.
   */
  /** Options + a gate, shaped the way /profile gates its queries. */
  const gatedBy = <T extends object>(options: T, on: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled: on
  })
  const me = useQuery(computed(() => gatedBy(meQueryOptions(), authStore.isAuth)))
  const isOwner = computed(
    () =>
      me.data.value !== undefined &&
      me.data.value.displayName.toLowerCase() === (header.data.value?.name ?? '').toLowerCase()
  )

  const closed = computed(
    () => header.data.value !== undefined && !header.data.value.public && !isOwner.value
  )

  /** Data queries run only for a profile the server will answer about. */
  const enabled = computed(
    () => header.data.value !== undefined && (header.data.value.public || isOwner.value)
  )

  const gate = <T extends object>(options: T): T & { enabled: boolean } => ({
    ...options,
    enabled: enabled.value
  })

  const summary = useQuery(computed(() => gate(publicProfileSummaryQueryOptions(name.value))))
  const activity = useQuery(computed(() => gate(publicProfileActivityQueryOptions(name.value))))
  const pbs = useQuery(computed(() => gate(publicProfilePBsQueryOptions(name.value))))
  const histogram = useQuery(computed(() => gate(publicProfileHistogramQueryOptions(name.value))))
  const timeseries = useQuery(computed(() => gate(publicProfileTimeseriesQueryOptions(name.value))))
  const portrait = useQuery(computed(() => gate(publicProfilePortraitQueryOptions(name.value))))

  /**
   * The header's sparkline, off the SAME page of the public feed the runs
   * table below already asks for — one request, two readers. (The public route
   * takes no page size, so this is the server's default page rather than
   * /profile's longer one.)
   */
  const recentRuns = useQuery(computed(() => gate(publicProfileRunsQueryOptions(name.value))))
  const recentWpm = computed(() => wpmSeries(recentRuns.data.value?.runs))

  /** 403 portrait_closed is a STATE the section renders, not a failure. */
  const portraitClosed = computed(
    () =>
      portrait.isError.value &&
      isApiError(portrait.error.value) &&
      portrait.error.value.status === 403
  )
  const portraitFailed = computed(() => portrait.isError.value && !portraitClosed.value)

  const toHome = (): void => void router.push(routeLocation.home())
  const toReplay = (runId: string): void =>
    void router.push({ name: ROUTE_NAMES.REPLAY, params: { runId } })
</script>
