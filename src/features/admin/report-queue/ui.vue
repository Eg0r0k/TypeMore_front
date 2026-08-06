<template>
  <section class="mt-4 flex min-w-0 flex-col gap-4" :aria-label="t('admin.reports.label')">
    <div class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="t('admin.reports.label')">
      <button
        v-for="option in FILTERS"
        :key="option"
        type="button"
        class="focus-ring rounded-[6px] border border-sub px-2 py-1 text-xs text-sub transition-tm hover:text-text"
        :class="{ 'bg-sub-alt text-text': filter === option }"
        :aria-pressed="filter === option"
        :data-testid="`admin-reports-filter-${option}`"
        @click="filter = option"
      >
        {{ t(`admin.reports.filter.${option}`) }}
      </button>
    </div>

    <div v-if="queue.isPending.value" class="flex flex-col gap-2" data-testid="admin-reports-skeleton">
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-[6px] bg-sub-alt" />
    </div>

    <div v-else-if="queue.isError.value" class="flex items-center gap-3" data-testid="admin-reports-error">
      <Typography size="s" color="sub">{{ t('admin.reports.loadFailed') }}</Typography>
      <Button color="shadow" size="s" @click="() => queue.refetch()">
        {{ t('admin.reports.retry') }}
      </Button>
    </div>

    <Typography v-else-if="items.length === 0" size="s" color="sub" data-testid="admin-reports-empty">
      {{ t('admin.reports.empty') }}
    </Typography>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="item in items"
        :key="itemKey(item)"
        class="flex flex-col gap-2 rounded-[6px] border border-sub-alt px-3 py-2"
        data-testid="admin-reports-item"
      >
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <component :is="SUBJECT_ICONS[item.subject.type] ?? IconFlag" class="size-4 shrink-0 text-sub" aria-hidden="true" />

          <RouterLink
            v-if="profileNameOf(item)"
            :to="routeLocation.user(profileNameOf(item)!)"
            class="focus-ring link-main min-w-0 truncate text-sm"
            :data-testid="`admin-reports-subject-${item.subject.type}`"
          >
            {{ profileNameOf(item) }}
          </RouterLink>
          <span
            v-else
            class="min-w-0 truncate text-sm text-text"
            :title="item.snapshot.quoteText"
            :data-testid="`admin-reports-subject-${item.subject.type}`"
          >
            {{ item.snapshot.quoteText ?? item.subject.id }}
          </span>

          <span v-if="item.snapshot.quoteLang" class="text-xs text-sub">
            {{ item.snapshot.quoteLang }}
          </span>
          <span v-if="item.snapshot.quoteWithdrawn" class="text-xs text-sub">
            {{ t('admin.reports.withdrawn') }}
          </span>
          <span v-if="item.snapshot.runStatus" class="text-xs text-sub">
            {{ item.snapshot.runStatus }}
          </span>

          <span class="ml-auto text-sm tabular-nums text-text" data-testid="admin-reports-count">
            {{ item.openReports }} {{ t('admin.reports.reports', item.openReports) }}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            v-for="reason in item.reasons"
            :key="reason"
            class="rounded-[6px] bg-sub-alt px-2 py-0.5 text-xs text-sub"
          >
            {{ t(`report.reasons.${reason}`) }}
          </span>
          <span
            class="text-xs text-sub"
            :title="formatExactInstant(item.lastReported, locale)"
          >
            {{ t('admin.reports.last', { date: formatShortDate(item.lastReported, locale) }) }}
          </span>
          <button
            type="button"
            class="focus-ring ml-auto rounded-[6px] px-2 py-1 text-xs text-sub transition-tm hover:text-text"
            :aria-expanded="isOpen(item)"
            :data-testid="`admin-reports-toggle-${item.subject.type}-${item.subject.id}`"
            @click="toggle(item)"
          >
            {{ isOpen(item) ? t('admin.reports.hide') : t('admin.reports.show') }}
          </button>
        </div>

        <SubjectPanel v-if="isOpen(item)" :subject="item.subject" :can-resolve="canResolve" />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import IconUser from '~icons/tabler/user'
  import IconQuote from '~icons/tabler/quote'
  import IconKeyboard from '~icons/tabler/keyboard'
  import IconFlag from '~icons/tabler/flag'

  import { reportQueueQueryOptions, type ReportQueueItem } from '@shared/api'
  import { useCurrentUser } from '@/entities/auth'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import SubjectPanel from './subject-panel.vue'

  /**
   * The triage inbox. One row is one SUBJECT (the server groups; forty
   * complaints about one quote are one decision), ordered by pressure. Rows
   * only record decisions or link out — the act a verdict refers to happens on
   * the surface that owns it, so a ban or a withdrawal is a navigation, not a
   * button here.
   */
  const { t, locale } = useI18n()

  const FILTERS = ['all', 'user', 'quote', 'run'] as const
  type Filter = (typeof FILTERS)[number]
  const filter = ref<Filter>('all')

  const queue = useQuery(
    computed(() => reportQueueQueryOptions(filter.value === 'all' ? undefined : filter.value))
  )
  const items = computed(() => queue.data.value?.items ?? [])

  const { data: user } = useCurrentUser()
  const canResolve = computed(() => (user.value?.permissions ?? []).includes('reports:write'))

  const SUBJECT_ICONS: Record<string, unknown> = {
    user: IconUser,
    quote: IconQuote,
    run: IconKeyboard
  }

  const itemKey = (item: ReportQueueItem): string => `${item.subject.type}:${item.subject.id}`

  const profileNameOf = (item: ReportQueueItem): string | null =>
    item.snapshot.userName ?? item.snapshot.runOwnerName ?? null

  const open = ref<string | null>(null)
  const isOpen = (item: ReportQueueItem): boolean => open.value === itemKey(item)
  const toggle = (item: ReportQueueItem): void => {
    open.value = isOpen(item) ? null : itemKey(item)
  }
</script>
