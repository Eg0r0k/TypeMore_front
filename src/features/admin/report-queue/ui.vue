<template>
  <section class="flex min-w-0 flex-col" :aria-label="t('admin.reports.label')">
    <SectionHeader :title="t('admin.reports.label')" :description="t('admin.reports.lead')" />

    <ToggleGroup
      class="mt-5"
      :model-value="filter"
      :aria-label="t('admin.reports.label')"
      @update:model-value="onFilter"
    >
      <ToggleGroupItem
        v-for="option in FILTERS"
        :key="option"
        :value="option"
        :data-testid="`admin-reports-filter-${option}`"
      >
        {{ t(`admin.reports.filter.${option}`) }}
      </ToggleGroupItem>
    </ToggleGroup>

    <div v-if="queue.isPending.value" class="mt-4 flex flex-col gap-1" data-testid="admin-reports-skeleton">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-[6px] bg-sub-alt" />
    </div>

    <div v-else-if="queue.isError.value" class="mt-4 flex items-center gap-3" data-testid="admin-reports-error">
      <Typography size="s" color="sub">{{ t('admin.reports.loadFailed') }}</Typography>
      <Button color="shadow" size="s" @click="() => queue.refetch()">
        {{ t('admin.reports.retry') }}
      </Button>
    </div>

    <div
      v-else-if="items.length === 0"
      class="mt-4 flex flex-col items-center gap-1 rounded-[6px] bg-sub-alt/40 px-4 py-10 text-center"
      data-testid="admin-reports-empty"
    >
      <IconFlag class="size-6 text-sub" aria-hidden="true" />
      <Typography size="s" color="sub">{{ t('admin.reports.empty') }}</Typography>
    </div>

    <ul v-else class="mt-4 flex flex-col gap-1">
      <li
        v-for="item in items"
        :key="itemKey(item)"
        class="rounded-[6px] transition-tm"
        :class="isOpen(item) ? 'bg-sub-alt/40' : 'hover:bg-sub-alt/25'"
        data-testid="admin-reports-item"
      >
        <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5">
          <component
            :is="SUBJECT_ICONS[item.subject.type] ?? IconFlag"
            class="size-4 shrink-0 text-sub"
            aria-hidden="true"
          />

          <div class="flex min-w-0 flex-col gap-0.5">
            <div class="flex min-w-0 items-baseline gap-x-2">
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
              <span v-if="item.snapshot.quoteLang" class="shrink-0 text-xs text-sub">
                {{ item.snapshot.quoteLang }}
              </span>
              <span v-if="item.snapshot.quoteWithdrawn" class="shrink-0 text-xs text-sub">
                {{ t('admin.reports.withdrawn') }}
              </span>
              <span v-if="item.snapshot.runStatus" class="shrink-0 text-xs text-sub">
                {{ item.snapshot.runStatus }}
              </span>
            </div>
            <p class="truncate text-xs text-sub">
              {{ reasonsLine(item) }}
            </p>
          </div>

          <button
            type="button"
            class="focus-ring flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-sub transition-tm hover:bg-sub-alt hover:text-text"
            :aria-expanded="isOpen(item)"
            :aria-label="`${item.openReports} ${t('admin.reports.reports', item.openReports)}`"
            :data-testid="`admin-reports-toggle-${item.subject.type}-${item.subject.id}`"
            @click="toggle(item)"
          >
            <span class="text-sm font-semibold tabular-nums text-text" data-testid="admin-reports-count">
              {{ item.openReports }}
            </span>
            <IconChevronDown
              class="size-4 shrink-0 transition-tm"
              :class="isOpen(item) && 'rotate-180'"
              aria-hidden="true"
            />
          </button>
        </div>

        <SubjectPanel
          v-if="isOpen(item)"
          class="px-3 pb-3 pl-10"
          :subject="item.subject"
          :can-resolve="canResolve"
        />
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
  import IconChevronDown from '~icons/tabler/chevron-down'

  import { reportQueueQueryOptions, type ReportQueueItem } from '@shared/api'
  import { usePermissions } from '@/entities/auth'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import SectionHeader from '../parts/section-header.vue'
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

  const onFilter = (value: unknown): void => {
    // Reka answers a re-click of the active segment with an empty value; a
    // filter always has exactly one state, so that means "keep it".
    if (typeof value === 'string' && (FILTERS as readonly string[]).includes(value)) {
      filter.value = value as Filter
    }
  }

  const queue = useQuery(
    computed(() => reportQueueQueryOptions(filter.value === 'all' ? undefined : filter.value))
  )
  const items = computed(() => queue.data.value?.items ?? [])

  const { can } = usePermissions()
  const canResolve = computed(() => can('reports:write'))

  const SUBJECT_ICONS: Record<string, unknown> = {
    user: IconUser,
    quote: IconQuote,
    run: IconKeyboard
  }

  const itemKey = (item: ReportQueueItem): string => `${item.subject.type}:${item.subject.id}`

  const profileNameOf = (item: ReportQueueItem): string | null =>
    item.snapshot.userName ?? item.snapshot.runOwnerName ?? null

  const reasonsLine = (item: ReportQueueItem): string => {
    const reasons = item.reasons.map((reason) => t(`report.reasons.${reason}`))
    const last = t('admin.reports.last', { date: formatShortDate(item.lastReported, locale.value) })
    return [...reasons, last].join(' · ')
  }

  const open = ref<string | null>(null)
  const isOpen = (item: ReportQueueItem): boolean => open.value === itemKey(item)
  const toggle = (item: ReportQueueItem): void => {
    open.value = isOpen(item) ? null : itemKey(item)
  }
</script>
