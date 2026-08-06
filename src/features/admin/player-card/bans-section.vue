<template>
  <section class="flex flex-col gap-3" :aria-label="t('admin.players.bans.title')">
    <Typography tag-name="h2" size="m" color="primary">
      {{ t('admin.players.bans.title') }}
    </Typography>

    <Typography v-if="bans.length === 0" size="s" color="sub" data-testid="admin-bans-empty">
      {{ t('admin.players.bans.empty') }}
    </Typography>

    <ul v-else class="flex flex-col gap-2" data-testid="admin-bans-list">
      <li
        v-for="ban in bans"
        :key="ban.id"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[6px] bg-sub-alt px-3 py-2 text-sm"
      >
        <span v-if="ban.active" class="font-semibold text-error" data-testid="admin-ban-active">
          {{ t('admin.players.bans.active') }}
        </span>
        <span class="text-text">{{ ban.reason }}</span>
        <span class="text-xs text-sub">{{ t('admin.players.bans.by', { name: ban.issuedBy }) }}</span>
        <span class="text-xs text-sub" :title="formatExactInstant(ban.issuedAt, locale)">
          {{ formatShortDate(ban.issuedAt, locale) }}
        </span>
        <span class="text-xs text-sub">
          {{
            ban.expiresAt
              ? t('admin.players.bans.until', { date: formatShortDate(ban.expiresAt, locale) })
              : t('admin.players.bans.permanent')
          }}
        </span>
        <span v-if="ban.revokedAt" class="text-xs text-sub">
          {{ t('admin.players.bans.revoked', { date: formatShortDate(ban.revokedAt, locale) }) }}
        </span>
        <Button
          v-if="ban.active && canWrite"
          color="shadow"
          size="s"
          class="ml-auto"
          :disabled="revoke.isPending.value"
          data-testid="admin-unban"
          @click="revoke.mutate(ban.userId)"
        >
          {{ t('admin.players.bans.unban') }}
        </Button>
      </li>
    </ul>

    <form
      v-if="canWrite"
      class="flex flex-wrap items-center gap-2"
      data-testid="admin-ban-form"
      @submit.prevent="onIssue"
    >
      <Input
        v-model="reason"
        :placeholder="t('admin.players.bans.reasonPlaceholder')"
        class="min-w-56 flex-1"
        data-testid="admin-ban-reason"
      />
      <Input
        v-model="until"
        :placeholder="t('admin.players.bans.untilPlaceholder')"
        class="w-64"
        data-testid="admin-ban-until"
      />
      <Button
        type="submit"
        color="main"
        size="s"
        :disabled="issue.isPending.value || reason.trim() === ''"
        data-testid="admin-ban-submit"
      >
        {{ t('admin.players.bans.issue') }}
      </Button>
      <Typography v-if="outcome" size="xs" color="sub" data-testid="admin-ban-outcome">
        {{ t(outcome) }}
      </Typography>
    </form>
  </section>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import {
    useIssueBanMutation,
    useRevokeBanMutation,
    type AdminUser,
    type Ban
  } from '@shared/api'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { Button } from '@/shared/ui/button'
  import { Input } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'

  const props = defineProps<{
    user: AdminUser
    bans: readonly Ban[]
    canWrite: boolean
  }>()

  const { t, locale } = useI18n()

  const reason = ref('')
  const until = ref('')
  const outcome = ref<string | null>(null)

  const issue = useIssueBanMutation()
  const revoke = useRevokeBanMutation()

  const onIssue = (): void => {
    outcome.value = null
    issue.mutate(
      {
        // The uuid, not the identifier the card was found by: an issue is
        // precise or it is not sent.
        user: props.user.id,
        reason: reason.value.trim(),
        ...(until.value.trim() ? { until: until.value.trim() } : {})
      },
      {
        onSuccess: (result) => {
          outcome.value = result.amended ? 'admin.players.bans.amended' : 'admin.players.bans.issued'
          reason.value = ''
          until.value = ''
        },
        onError: () => (outcome.value = 'admin.players.bans.failed')
      }
    )
  }
</script>
