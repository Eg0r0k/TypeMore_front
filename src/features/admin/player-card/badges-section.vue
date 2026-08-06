<template>
  <section class="flex flex-col gap-3" :aria-label="t('admin.players.badges.title')">
    <Typography tag-name="h2" size="m" color="primary">
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

    <ul v-else class="flex flex-col gap-2" data-testid="admin-badges-list">
      <li
        v-for="grant in data.badges"
        :key="grant.code"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[6px] bg-sub-alt px-3 py-2 text-sm"
      >
        <span class="font-mono text-text">{{ grant.code }}</span>
        <span v-if="!grant.granted" class="text-xs text-sub">
          {{ t('admin.players.badges.revokedTag') }}
        </span>
        <span v-else-if="!grant.shown" class="text-xs text-sub">
          {{ t('admin.players.badges.hidden') }}
        </span>
        <span v-if="grant.grantedBy" class="text-xs text-sub">
          {{ t('admin.players.bans.by', { name: grant.grantedBy }) }}
        </span>
        <span class="text-xs text-sub" :title="formatExactInstant(grant.grantedAt, locale)">
          {{ formatShortDate(grant.grantedAt, locale) }}
        </span>
        <Button
          v-if="grant.granted && canWrite"
          color="shadow"
          size="s"
          class="ml-auto"
          :disabled="revoke.isPending.value"
          :data-testid="`admin-badge-revoke-${grant.code}`"
          @click="revoke.mutate({ identifier: data.user.id, code: grant.code })"
        >
          {{ t('admin.players.badges.revoke') }}
        </Button>
      </li>
    </ul>

    <div v-if="canWrite && grantable.length > 0" class="flex flex-wrap items-center gap-1.5">
      <Button
        v-for="code in grantable"
        :key="code"
        color="shadow"
        size="s"
        :disabled="grantMutation.isPending.value"
        :data-testid="`admin-badge-grant-${code}`"
        @click="grantMutation.mutate({ identifier: data.user.id, code })"
      >
        {{ t('admin.players.badges.grant', { code }) }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useGrantBadgeMutation, useRevokeBadgeMutation, type UserBadges } from '@shared/api'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  const props = defineProps<{
    data: UserBadges
    canWrite: boolean
  }>()

  const { t, locale } = useI18n()

  const grantMutation = useGrantBadgeMutation()
  const revoke = useRevokeBadgeMutation()

  const grantable = computed(() => {
    const held = new Set(props.data.badges.filter((b) => b.granted).map((b) => b.code))
    return props.data.knownBadges.filter((code) => !held.has(code))
  })
</script>
