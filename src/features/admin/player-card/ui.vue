<template>
  <section class="mt-4 flex min-w-0 flex-col gap-4" :aria-label="t('admin.players.label')">
    <form class="flex flex-wrap items-center gap-2" @submit.prevent="onSearch">
      <Input
        v-model="draft"
        :placeholder="t('admin.players.searchPlaceholder')"
        class="min-w-64 flex-1"
        data-testid="admin-player-search"
      />
      <Button
        type="submit"
        color="main"
        size="s"
        :disabled="draft.trim() === ''"
        data-testid="admin-player-open"
      >
        {{ t('admin.players.search') }}
      </Button>
    </form>

    <template v-if="identifier !== null">
      <div v-if="bans.isPending.value" class="flex flex-col gap-2">
        <div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-[6px] bg-sub-alt" />
      </div>

      <Typography
        v-else-if="notFound"
        size="s"
        color="sub"
        data-testid="admin-player-not-found"
      >
        {{ t('admin.players.notFound') }}
      </Typography>

      <div v-else-if="candidates.length > 0" class="flex flex-col gap-2">
        <Typography size="s" color="sub">{{ t('admin.players.ambiguous') }}</Typography>
        <div class="flex flex-wrap items-center gap-1.5">
          <Button
            v-for="candidate in candidates"
            :key="candidate.id"
            color="shadow"
            size="s"
            :data-testid="`admin-player-candidate-${candidate.displayName}`"
            @click="pick(candidate)"
          >
            {{ candidate.displayName }}
          </Button>
        </div>
      </div>

      <div v-else-if="bans.isError.value" class="flex items-center gap-3">
        <Typography size="s" color="sub">{{ t('admin.players.loadFailed') }}</Typography>
        <Button color="shadow" size="s" @click="() => bans.refetch()">
          {{ t('admin.players.retry') }}
        </Button>
      </div>

      <template v-else-if="bans.data.value !== undefined">
        <div
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1"
          data-testid="admin-player-header"
        >
          <Typography tag-name="h2" size="l" color="primary">
            {{ bans.data.value.user.displayName }}
          </Typography>
          <span
            v-if="bans.data.value.restricted"
            class="text-sm font-semibold text-error"
            data-testid="admin-player-restricted"
          >
            {{ t('admin.players.restricted') }}
          </span>
          <span class="font-mono text-xs text-sub">{{ bans.data.value.user.id }}</span>
          <RouterLink
            :to="routeLocation.user(bans.data.value.user.displayName)"
            class="link-main text-sm"
            data-testid="admin-player-profile-link"
          >
            {{ t('admin.players.openProfile') }}
          </RouterLink>
        </div>

        <BansSection
          :user="bans.data.value.user"
          :bans="bans.data.value.bans"
          :can-write="canBanWrite"
        />
        <BadgesSection v-if="badges.data.value" :data="badges.data.value" :can-write="canBanWrite" />
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import * as v from 'valibot'

  import {
    isApiError,
    playerBadgesQueryOptions,
    playerBansQueryOptions,
    ResolutionCandidatesSchema,
    type AdminUser
  } from '@shared/api'
  import { usePermissions } from '@/entities/auth'
  import { routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { Input } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import BadgesSection from './badges-section.vue'
  import BansSection from './bans-section.vue'

  /**
   * One player, everything a moderator can do to them. The server resolves the
   * identifier (uuid → email → nick, refusing ambiguity with the candidates),
   * so this card never guesses: a 409 renders as a choice, and picking one
   * re-asks by uuid.
   */
  const { t } = useI18n()
  const { can } = usePermissions()
  const canBanWrite = computed(() => can('bans:write'))

  const draft = ref('')
  const identifier = ref<string | null>(null)

  const onSearch = (): void => {
    if (draft.value.trim() === '') return
    identifier.value = draft.value.trim()
  }

  const enabledOn = <T extends object>(options: T, on: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled: on
  })

  const bans = useQuery(
    computed(() => enabledOn(playerBansQueryOptions(identifier.value ?? ''), identifier.value !== null))
  )
  const badges = useQuery(
    computed(() =>
      enabledOn(
        playerBadgesQueryOptions(identifier.value ?? ''),
        identifier.value !== null && bans.isSuccess.value
      )
    )
  )

  const notFound = computed(
    () => bans.isError.value && isApiError(bans.error.value) && bans.error.value.status === 404
  )

  const candidates = computed<readonly AdminUser[]>(() => {
    if (!bans.isError.value || !isApiError(bans.error.value)) return []
    if (bans.error.value.status !== 409) return []
    const parsed = v.safeParse(ResolutionCandidatesSchema, bans.error.value.details)
    return parsed.success ? parsed.output.candidates : []
  })

  const pick = (candidate: AdminUser): void => {
    draft.value = candidate.displayName
    identifier.value = candidate.id
  }
</script>
