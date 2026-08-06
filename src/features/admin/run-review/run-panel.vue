<template>
  <div class="flex flex-col gap-3">
    <p v-if="overrides.isPending.value" class="text-sm text-sub">
      {{ t('admin.runs.loading') }}
    </p>

    <div v-else-if="overrides.isError.value" class="flex items-center gap-3">
      <Typography size="s" color="sub">{{ t('admin.runs.historyFailed') }}</Typography>
      <Button color="shadow" size="s" @click="() => overrides.refetch()">
        {{ t('admin.runs.retry') }}
      </Button>
    </div>

    <ul
      v-else-if="history.length > 0"
      class="flex flex-col gap-2"
      data-testid="admin-run-overrides"
    >
      <li
        v-for="decision in history"
        :key="decision.id"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[6px] bg-bg/60 px-3 py-2 text-sm"
      >
        <span class="text-text">
          {{ decision.fromStatus }} → {{ decision.toStatus }}
        </span>
        <span class="text-xs text-sub">{{ decision.reason }}</span>
        <span v-if="decision.decidedByName" class="text-xs text-sub">
          {{ t('admin.players.bans.by', { name: decision.decidedByName }) }}
        </span>
        <span class="text-xs text-sub" :title="formatExactInstant(decision.decidedAt, locale)">
          {{ formatShortDate(decision.decidedAt, locale) }}
        </span>
      </li>
    </ul>

    <Typography v-else size="xs" color="sub" data-testid="admin-run-no-overrides">
      {{ t('admin.runs.noOverrides') }}
    </Typography>

    <form
      v-if="canOverride"
      class="flex flex-wrap items-center gap-2"
      data-testid="admin-run-override-form"
      @submit.prevent="onOverride"
    >
      <ToggleGroup
        :model-value="target"
        :aria-label="t('admin.runs.overrideLabel')"
        @update:model-value="onTarget"
      >
        <ToggleGroupItem
          v-for="status in TARGETS"
          :key="status"
          :value="status"
          :disabled="status === run.status"
          :data-testid="`admin-run-target-${status}`"
        >
          {{ t(`admin.runs.status.${status}`) }}
        </ToggleGroupItem>
      </ToggleGroup>
      <Input
        v-model="reason"
        :placeholder="t('admin.runs.reasonPlaceholder')"
        class="min-w-56 flex-1"
        data-testid="admin-run-reason"
      />
      <Button
        type="submit"
        color="main"
        size="s"
        :disabled="override.isPending.value || target === null || reason.trim() === ''"
        data-testid="admin-run-override-submit"
      >
        {{ t('admin.runs.override') }}
      </Button>
      <Typography v-if="failed" size="xs" color="sub">
        {{ t('admin.runs.overrideFailed') }}
      </Typography>
    </form>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'

  import {
    runOverridesQueryOptions,
    useOverrideRunMutation,
    type OverridableStatus,
    type ReviewRow
  } from '@shared/api'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { Button } from '@/shared/ui/button'
  import { Input } from '@/shared/ui/input'
  import { toast } from '@/shared/ui/sonner'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'

  const props = defineProps<{
    run: ReviewRow
    canOverride: boolean
  }>()

  const { t, locale } = useI18n()

  const TARGETS: readonly OverridableStatus[] = ['accepted', 'flagged', 'rejected']

  const overrides = useQuery(runOverridesQueryOptions(props.run.id))
  const history = computed(() => overrides.data.value?.overrides ?? [])

  const target = ref<OverridableStatus | null>(null)
  const reason = ref('')
  const failed = ref(false)

  const onTarget = (value: unknown): void => {
    if (typeof value === 'string' && (TARGETS as readonly string[]).includes(value)) {
      target.value = value as OverridableStatus
    }
  }

  const override = useOverrideRunMutation()

  const onOverride = (): void => {
    if (target.value === null || reason.value.trim() === '') return
    failed.value = false
    override.mutate(
      { runId: props.run.id, status: target.value, reason: reason.value.trim() },
      {
        onSuccess: () => toast(t('admin.runs.overridden')),
        onError: () => (failed.value = true)
      }
    )
  }
</script>
