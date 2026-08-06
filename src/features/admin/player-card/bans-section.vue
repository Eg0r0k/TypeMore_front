<template>
  <section class="flex min-w-0 flex-col gap-3" :aria-label="t('admin.players.bans.title')">
    <div class="flex items-baseline gap-2">
      <Typography tag-name="h4" size="m" color="primary">
        {{ t('admin.players.bans.title') }}
      </Typography>
      <span v-if="bans.length > 0" class="text-xs tabular-nums text-sub">{{ bans.length }}</span>
    </div>

    <Typography v-if="bans.length === 0" size="s" color="sub" data-testid="admin-bans-empty">
      {{ t('admin.players.bans.empty') }}
    </Typography>

    <ul v-else class="flex flex-col gap-1.5" data-testid="admin-bans-list">
      <li
        v-for="ban in bans"
        :key="ban.id"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[6px] bg-bg/60 px-3 py-2"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex min-w-0 items-center gap-2">
            <span
              v-if="ban.active"
              class="size-1.5 shrink-0 rounded-full bg-error"
              :title="t('admin.players.bans.active')"
              data-testid="admin-ban-active"
            />
            <span class="min-w-0 truncate text-sm text-text">{{ ban.reason }}</span>
          </div>
          <p class="truncate text-xs text-sub" :title="formatExactInstant(ban.issuedAt, locale)">
            {{ metaLine(ban) }}
          </p>
        </div>
        <Button
          v-if="ban.active && canWrite"
          color="shadow"
          size="s"
          :disabled="revoke.isPending.value"
          data-testid="admin-unban"
          @click="onRevoke(ban.userId)"
        >
          {{ t('admin.players.bans.unban') }}
        </Button>
      </li>
    </ul>

    <form
      v-if="canWrite"
      class="flex flex-col gap-2 rounded-[6px] bg-bg/40 p-3"
      data-testid="admin-ban-form"
      @submit.prevent="onIssue"
    >
      <Typography size="xs" color="sub">{{ t('admin.players.bans.formTitle') }}</Typography>
      <div class="flex flex-wrap items-center gap-2">
        <Input
          v-model="reason"
          :placeholder="t('admin.players.bans.reasonPlaceholder')"
          class="min-w-44 flex-1"
          data-testid="admin-ban-reason"
        />
        <Input
          v-model="until"
          :placeholder="t('admin.players.bans.untilPlaceholder')"
          class="w-36"
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
      </div>
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
  import { toast } from '@/shared/ui/sonner'
  import { Typography } from '@/shared/ui/typography'

  const props = defineProps<{
    user: AdminUser
    bans: readonly Ban[]
    canWrite: boolean
  }>()

  const { t, locale } = useI18n()

  const metaLine = (ban: Ban): string => {
    const parts = [
      ban.expiresAt
        ? t('admin.players.bans.until', { date: formatShortDate(ban.expiresAt, locale.value) })
        : t('admin.players.bans.permanent'),
      t('admin.players.bans.by', { name: ban.issuedBy }),
      formatShortDate(ban.issuedAt, locale.value)
    ]
    if (ban.revokedAt) {
      parts.push(
        t('admin.players.bans.revoked', { date: formatShortDate(ban.revokedAt, locale.value) })
      )
    }
    return parts.join(' · ')
  }

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
          toast(t(outcome.value))
          reason.value = ''
          until.value = ''
        },
        onError: () => (outcome.value = 'admin.players.bans.failed')
      }
    )
  }

  const onRevoke = (userId: string): void => {
    revoke.mutate(userId, {
      onSuccess: () => toast(t('admin.players.bans.unbanned'))
    })
  }
</script>
