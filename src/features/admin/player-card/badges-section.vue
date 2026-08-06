<template>
  <section class="flex min-w-0 flex-col gap-3" :aria-label="t('admin.players.badges.title')">
    <Typography tag-name="h4" size="m" color="primary">
      {{ t('admin.players.badges.title') }}
    </Typography>

    <Typography
      v-if="data.badges.length === 0"
      size="s"
      color="sub"
      data-testid="admin-badges-empty"
    >
      {{ t('admin.players.badges.empty') }}
    </Typography>

    <TooltipProvider v-else :delay-duration="80">
      <ul class="flex flex-col gap-1.5" data-testid="admin-badges-list">
        <li
          v-for="grant in data.badges"
          :key="grant.code"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[6px] bg-bg/60 px-3 py-2"
          :class="!grant.granted && 'opacity-60'"
        >
          <div class="flex min-w-0 flex-col gap-1">
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <BadgeChip v-if="chipOf(grant.code)" :badge="chipOf(grant.code)!" />
              <span v-else class="font-mono text-sm text-text">{{ grant.code }}</span>
              <span v-if="!grant.granted" class="text-xs text-sub">
                {{ t('admin.players.badges.revokedTag') }}
              </span>
              <span v-else-if="!grant.shown" class="text-xs text-sub">
                {{ t('admin.players.badges.hidden') }}
              </span>
            </div>
            <p class="truncate text-xs text-sub" :title="formatExactInstant(grant.grantedAt, locale)">
              {{ metaLine(grant) }}
            </p>
          </div>
          <Button
            v-if="grant.granted && canWrite"
            color="shadow"
            size="s"
            :disabled="revoke.isPending.value"
            :data-testid="`admin-badge-revoke-${grant.code}`"
            @click="onRevoke(grant.code)"
          >
            {{ t('admin.players.badges.revoke') }}
          </Button>
        </li>
      </ul>
    </TooltipProvider>

    <div v-if="canWrite && grantable.length > 0" class="flex flex-col gap-2 rounded-[6px] bg-bg/40 p-3">
      <Typography size="xs" color="sub">{{ t('admin.players.badges.grantTitle') }}</Typography>
      <div class="flex flex-wrap items-center gap-1.5">
        <Button
          v-for="code in grantable"
          :key="code"
          color="shadow"
          size="s"
          :disabled="grantMutation.isPending.value"
          :data-testid="`admin-badge-grant-${code}`"
          @click="onGrant(code)"
        >
          <IconPlus class="size-3.5" aria-hidden="true" />
          {{ badgeOf(code)?.name ?? code }}
        </Button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import IconPlus from '~icons/tabler/plus'

  import { useGrantBadgeMutation, useRevokeBadgeMutation, type BadgeGrant, type UserBadges } from '@shared/api'
  import { BadgeChip, badgeOf, type BadgeDefinition } from '@/entities/badge'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { Button } from '@/shared/ui/button'
  import { toast } from '@/shared/ui/sonner'
  import { TooltipProvider } from '@/shared/ui/tooltip'
  import { Typography } from '@/shared/ui/typography'

  const props = defineProps<{
    data: UserBadges
    canWrite: boolean
  }>()

  const { t, locale } = useI18n()

  /** null for a code this build cannot draw — the row shows the raw code then. */
  const chipOf = (code: string): BadgeDefinition | null => badgeOf(code)

  const metaLine = (grant: BadgeGrant): string => {
    const parts: string[] = []
    if (grant.grantedBy) parts.push(t('admin.players.bans.by', { name: grant.grantedBy }))
    parts.push(formatShortDate(grant.grantedAt, locale.value))
    return parts.join(' · ')
  }

  const grantMutation = useGrantBadgeMutation()
  const revoke = useRevokeBadgeMutation()

  const onGrant = (code: string): void => {
    grantMutation.mutate(
      { identifier: props.data.user.id, code },
      { onSuccess: () => toast(t('admin.players.badges.granted')) }
    )
  }

  const onRevoke = (code: string): void => {
    revoke.mutate(
      { identifier: props.data.user.id, code },
      { onSuccess: () => toast(t('admin.players.badges.revoked')) }
    )
  }

  const grantable = computed(() => {
    const held = new Set(props.data.badges.filter((b) => b.granted).map((b) => b.code))
    return props.data.knownBadges.filter((code) => !held.has(code))
  })
</script>
