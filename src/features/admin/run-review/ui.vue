<template>
  <section class="flex min-w-0 flex-col" :aria-label="t('admin.runs.label')">
    <SectionHeader :title="t('admin.runs.label')" :description="t('admin.runs.lead')" />

    <ToggleGroup
      class="mt-5"
      :model-value="String(floor)"
      :aria-label="t('admin.runs.floorLabel')"
      @update:model-value="onFloor"
    >
      <ToggleGroupItem
        v-for="preset in FLOORS"
        :key="preset"
        :value="String(preset)"
        :data-testid="`admin-runs-floor-${preset}`"
      >
        {{ preset === 0 ? t('admin.runs.floorAll') : `≥ ${preset}` }}
      </ToggleGroupItem>
    </ToggleGroup>

    <div v-if="queue.isPending.value" class="mt-4 flex flex-col gap-1" data-testid="admin-runs-skeleton">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-[6px] bg-sub-alt" />
    </div>

    <div v-else-if="queue.isError.value" class="mt-4 flex items-center gap-3" data-testid="admin-runs-error">
      <Typography size="s" color="sub">{{ t('admin.runs.loadFailed') }}</Typography>
      <Button color="shadow" size="s" @click="() => queue.refetch()">
        {{ t('admin.runs.retry') }}
      </Button>
    </div>

    <div
      v-else-if="runs.length === 0"
      class="mt-4 flex flex-col items-center gap-1 rounded-[6px] bg-sub-alt/40 px-4 py-10 text-center"
      data-testid="admin-runs-empty"
    >
      <IconKeyboard class="size-6 text-sub" aria-hidden="true" />
      <Typography size="s" color="sub">{{ t('admin.runs.empty') }}</Typography>
    </div>

    <ul v-else class="mt-4 flex flex-col gap-1">
      <li
        v-for="run in runs"
        :key="run.id"
        class="rounded-[6px] transition-tm"
        :class="isOpen(run) ? 'bg-sub-alt/40' : 'hover:bg-sub-alt/25'"
        data-testid="admin-runs-item"
      >
        <div class="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 px-3 py-2.5">
          <div class="flex min-w-0 flex-col gap-0.5">
            <div class="flex min-w-0 items-baseline gap-x-2">
              <RouterLink
                v-if="run.userId"
                :to="routeLocation.adminPlayers(run.userId)"
                class="focus-ring link-main min-w-0 truncate text-sm"
                :title="t('admin.runs.openCard')"
                data-testid="admin-run-player"
              >
                {{ run.displayName ?? run.userId.slice(0, 8) }}
              </RouterLink>
              <span v-else class="font-mono text-xs text-sub">{{ run.id.slice(0, 8) }}</span>
              <span
                class="shrink-0 text-xs"
                :class="STATUS_TONE[run.status] ?? 'text-sub'"
                :data-testid="`admin-run-status-${run.status}`"
              >
                {{ t(`admin.runs.status.${run.status}`) }}
              </span>
              <span
                v-if="run.overridden"
                class="shrink-0 text-xs text-sub"
                data-testid="admin-run-overridden"
              >
                {{ t('admin.runs.overriddenTag') }}
              </span>
            </div>
            <p class="truncate text-xs text-sub">{{ detailLine(run) }}</p>
          </div>

          <span
            class="text-sm font-semibold tabular-nums"
            :class="run.suspicion >= HOT_SUSPICION ? 'text-error' : 'text-text'"
            :title="t('admin.runs.suspicion')"
            data-testid="admin-run-suspicion"
          >
            {{ run.suspicion.toFixed(2) }}
          </span>

          <RouterLink
            :to="{ name: ROUTE_NAMES.REPLAY, params: { runId: run.id } }"
            class="focus-ring flex items-center rounded-[6px] px-2.5 py-1.5 text-sub transition-tm hover:bg-sub-alt hover:text-text"
            :aria-label="t('admin.runs.watchReplay')"
            :title="t('admin.runs.watchReplay')"
            data-testid="admin-run-replay"
          >
            <IconPlayerPlay class="size-4 shrink-0" aria-hidden="true" />
          </RouterLink>

          <button
            type="button"
            class="focus-ring flex items-center rounded-[6px] px-2.5 py-1.5 text-sub transition-tm hover:bg-sub-alt hover:text-text"
            :aria-expanded="isOpen(run)"
            :aria-label="t('admin.runs.details')"
            :data-testid="`admin-runs-toggle-${run.id}`"
            @click="toggle(run)"
          >
            <IconChevronDown
              class="size-4 shrink-0 transition-tm"
              :class="isOpen(run) && 'rotate-180'"
              aria-hidden="true"
            />
          </button>
        </div>

        <RunPanel v-if="isOpen(run)" class="px-3 pb-3" :run="run" :can-override="canOverride" />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, useRoute } from 'vue-router'
  import IconKeyboard from '~icons/tabler/keyboard'
  import IconChevronDown from '~icons/tabler/chevron-down'
  import IconPlayerPlay from '~icons/tabler/player-play'

  import { reviewQueueQueryOptions, type ReviewRow } from '@shared/api'
  import { usePermissions } from '@/entities/auth'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import SectionHeader from '../parts/section-header.vue'
  import RunPanel from './run-panel.vue'

  /**
   * Judged runs at or above a suspicion floor, worst first — INCLUDING
   * accepted ones, which is the point: the queue surfaces the runs the machine
   * wanted help with, not the ones it already flagged (docs/MODERATION.md,
   * "The review queue").
   */
  const { t, locale } = useI18n()

  /** 0.1 is the server's own default floor; 0 lists every judged run. */
  const FLOORS = [0, 0.1, 0.3] as const
  const HOT_SUSPICION = 0.5

  // The hop from a report: ?run=<id> drops the floor (the run may sit below
  // any of them) and opens that run's panel.
  const route = useRoute()
  const focusedRun = ((): string | null => {
    const raw = route.query.run
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value !== '' ? value : null
  })()

  const floor = ref<number>(focusedRun === null ? 0.1 : 0)

  const onFloor = (value: unknown): void => {
    if (typeof value !== 'string') return
    const parsed = Number(value)
    if ((FLOORS as readonly number[]).includes(parsed)) floor.value = parsed
  }

  const queue = useQuery(computed(() => reviewQueueQueryOptions(floor.value)))
  const runs = computed(() => queue.data.value?.runs ?? [])

  const { can } = usePermissions()
  const canOverride = computed(() => can('runs:override'))

  const STATUS_TONE: Record<string, string> = {
    accepted: 'text-main',
    flagged: 'text-error',
    rejected: 'text-sub'
  }

  const detailLine = (run: ReviewRow): string => {
    const parts = [run.mode, run.lang].filter(Boolean) as string[]
    const wpm = run.metrics?.wpm
    if (wpm !== undefined) parts.push(`${Math.round(wpm)} wpm`)
    const acc = run.metrics?.acc
    if (acc !== undefined) parts.push(`${Math.round(acc * 100)}%`)
    parts.push(formatShortDate(run.createdAt, locale.value))
    return parts.join(' · ')
  }

  const open = ref<string | null>(focusedRun)
  const isOpen = (run: ReviewRow): boolean => open.value === run.id
  const toggle = (run: ReviewRow): void => {
    open.value = isOpen(run) ? null : run.id
  }
</script>
