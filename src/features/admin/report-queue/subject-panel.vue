<template>
  <div class="flex flex-col gap-3">
    <div v-if="subject.type !== 'quote'" class="flex flex-wrap items-center gap-1.5">
      <Button v-if="subject.type === 'user'" as-child color="shadow" size="s">
        <RouterLink
          :to="routeLocation.adminPlayers(subject.id)"
          data-testid="admin-report-open-card"
        >
          <IconUserCog class="size-4" aria-hidden="true" />
          {{ t('admin.reports.openCard') }}
        </RouterLink>
      </Button>
      <template v-if="subject.type === 'run'">
        <Button as-child color="shadow" size="s">
          <RouterLink
            :to="routeLocation.adminRuns(subject.id)"
            data-testid="admin-report-open-review"
          >
            <IconKeyboard class="size-4" aria-hidden="true" />
            {{ t('admin.reports.openReview') }}
          </RouterLink>
        </Button>
        <Button as-child color="shadow" size="s">
          <RouterLink
            :to="{ name: ROUTE_NAMES.REPLAY, params: { runId: subject.id } }"
            data-testid="admin-report-open-replay"
          >
            <IconPlayerPlay class="size-4" aria-hidden="true" />
            {{ t('admin.runs.watchReplay') }}
          </RouterLink>
        </Button>
      </template>
    </div>

    <p v-if="detail.isPending.value" class="text-sm text-sub">{{ t('admin.reports.loading') }}</p>

    <div v-else-if="detail.isError.value" class="flex items-center gap-3">
      <Typography size="s" color="sub">{{ t('admin.reports.detailFailed') }}</Typography>
      <Button color="shadow" size="s" @click="() => detail.refetch()">
        {{ t('admin.reports.retry') }}
      </Button>
    </div>

    <ul v-else class="flex flex-col gap-2" data-testid="admin-subject-reports">
      <li
        v-for="report in detail.data.value?.reports ?? []"
        :key="report.id"
        class="flex flex-col gap-1 rounded-[6px] bg-bg/60 px-3 py-2"
      >
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span class="text-text">{{ t(`report.reasons.${report.reason}`) }}</span>
          <span class="text-xs text-sub">{{ report.reporterName }}</span>
          <span class="text-xs text-sub" :title="formatExactInstant(report.createdAt, locale)">
            {{ formatShortDate(report.createdAt, locale) }}
          </span>
          <span v-if="report.status !== 'open'" class="text-xs text-sub">
            {{ t('admin.reports.resolvedAs', { status: report.status }) }}
          </span>
        </div>
        <p v-if="report.comment" class="whitespace-pre-line text-sm text-sub">
          {{ report.comment }}
        </p>
      </li>
    </ul>

    <form
      v-if="canResolve && !detail.isPending.value && !detail.isError.value"
      class="flex flex-wrap items-center gap-2"
      data-testid="admin-resolve-form"
      @submit.prevent
    >
      <Input
        v-model="note"
        :placeholder="t('admin.reports.notePlaceholder')"
        class="min-w-48 flex-1"
        data-testid="admin-resolve-note"
      />
      <Button
        color="main"
        size="s"
        :disabled="resolve.isPending.value"
        data-testid="admin-resolve-actioned"
        @click="onResolve('actioned')"
      >
        {{ t('admin.reports.actioned') }}
      </Button>
      <Button
        color="shadow"
        size="s"
        :disabled="resolve.isPending.value"
        data-testid="admin-resolve-dismissed"
        @click="onResolve('dismissed')"
      >
        {{ t('admin.reports.dismissed') }}
      </Button>
      <Typography v-if="failed" size="xs" color="sub">
        {{ t('admin.reports.resolveFailed') }}
      </Typography>
    </form>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import IconUserCog from '~icons/tabler/user-cog'
  import IconKeyboard from '~icons/tabler/keyboard'
  import IconPlayerPlay from '~icons/tabler/player-play'

  import {
    subjectReportsQueryOptions,
    useResolveReportsMutation,
    type QueueSubject,
    type ResolveVerdict
  } from '@shared/api'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { Input } from '@/shared/ui/input'
  import { toast } from '@/shared/ui/sonner'
  import { Typography } from '@/shared/ui/typography'

  const props = defineProps<{
    subject: QueueSubject
    canResolve: boolean
  }>()

  const { t, locale } = useI18n()

  const detail = useQuery(subjectReportsQueryOptions(props.subject.type, props.subject.id))

  const note = ref('')
  const failed = ref(false)
  const resolve = useResolveReportsMutation()

  const onResolve = (verdict: ResolveVerdict): void => {
    failed.value = false
    resolve.mutate(
      { subject: props.subject, verdict, ...(note.value.trim() ? { note: note.value.trim() } : {}) },
      {
        onSuccess: () => toast(t('admin.reports.resolvedToast')),
        onError: () => (failed.value = true)
      }
    )
  }
</script>
