<template>
  <section class="flex min-w-0 flex-col gap-4" :aria-label="t('admin.players.label')">
    <SectionHeader :title="t('admin.players.label')" :description="t('admin.players.lead')" />

    <form class="mt-1 flex max-w-xl flex-col gap-1" @submit.prevent="onSubmit">
      <SearchBar
        v-model="search.query.value"
        :placeholder="t('admin.players.searchPlaceholder')"
        data-testid="admin-player-search"
      />
      <ul
        v-if="suggestionsShown"
        class="flex flex-col gap-0.5"
        :aria-busy="search.refreshing.value"
        data-testid="admin-player-suggestions"
      >
        <li v-for="hit in search.hits.value" :key="hit.name">
          <button
            type="button"
            class="focus-ring flex w-full items-baseline gap-2 rounded-[6px] px-3 py-2 text-start transition-tm hover:bg-sub-alt"
            :data-testid="`admin-player-suggestion-${hit.name}`"
            @click="pick(hit.name)"
          >
            <span class="min-w-0 truncate text-sm text-text">{{ hit.name }}</span>
            <span class="ms-auto shrink-0 text-xs text-sub">
              {{ formatShortDate(hit.joined, locale) }}
            </span>
          </button>
        </li>
      </ul>
      <Typography
        v-else-if="search.state.value === 'searching'"
        size="xs"
        color="sub"
        role="status"
        data-testid="admin-player-searching"
      >
        {{ t('admin.players.searching') }}
      </Typography>
      <Typography
        v-else-if="search.state.value === 'error'"
        size="xs"
        color="error"
        role="status"
        data-testid="admin-player-search-error"
      >
        {{ t('admin.players.searchFailed') }}
      </Typography>
      <Typography v-else-if="identifier === null" size="xs" color="sub">
        {{ t('admin.players.searchHint') }}
      </Typography>
    </form>

    <template v-if="identifier !== null">
      <div v-if="bans.isPending.value" class="flex flex-col gap-2">
        <div class="h-20 animate-pulse rounded-[6px] bg-sub-alt" />
        <div class="h-40 animate-pulse rounded-[6px] bg-sub-alt" />
      </div>

      <Typography v-else-if="notFound" size="s" color="sub" data-testid="admin-player-not-found">
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
            @click="pickCandidate(candidate)"
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

      <article
        v-else-if="bans.data.value !== undefined"
        class="flex flex-col gap-6 rounded-[6px] bg-sub-alt/25 p-4 sm:p-5"
      >
        <div
          class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          data-testid="admin-player-header"
        >
          <UserAvatar :name="bans.data.value.user.displayName" :src="null" class="size-12" />
          <div class="flex min-w-0 flex-col gap-0.5">
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <Typography tag-name="h3" size="l" color="primary" class="min-w-0 truncate">
                {{ bans.data.value.user.displayName }}
              </Typography>
              <span
                v-if="bans.data.value.restricted"
                class="text-sm font-semibold text-error"
                data-testid="admin-player-restricted"
              >
                {{ t('admin.players.restricted') }}
              </span>
            </div>
            <span class="truncate font-mono text-xs text-sub">{{ bans.data.value.user.id }}</span>
          </div>
          <Button as-child color="shadow" size="s" class="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-auto">
            <RouterLink
              :to="routeLocation.user(bans.data.value.user.displayName)"
              data-testid="admin-player-profile-link"
            >
              {{ t('admin.players.openProfile') }}
            </RouterLink>
          </Button>
        </div>

        <div class="grid items-start gap-x-8 gap-y-6 lg:grid-cols-2">
          <BansSection
            :user="bans.data.value.user"
            :bans="bans.data.value.bans"
            :can-write="canBanWrite"
          />
          <BadgesSection
            v-if="badges.data.value"
            :data="badges.data.value"
            :can-write="canBanWrite"
          />
        </div>
      </article>
    </template>
  </section>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, useRoute } from 'vue-router'
  import * as v from 'valibot'

  import {
    isApiError,
    playerBadgesQueryOptions,
    playerBansQueryOptions,
    ResolutionCandidatesSchema,
    type AdminUser
  } from '@shared/api'
  import { usePermissions } from '@/entities/auth'
  import { usePlayerSearch } from '@/features/friends/player-search'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { routeLocation } from '@/shared/router'
  import { UserAvatar } from '@/shared/ui/avatar'
  import { Button } from '@/shared/ui/button'
  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'
  import SectionHeader from '../parts/section-header.vue'
  import BadgesSection from './badges-section.vue'
  import BansSection from './bans-section.vue'

  /**
   * One player, everything a moderator can do to them. Typing offers NAME
   * suggestions (the same live search the friends page uses); a uuid or an
   * email is submitted as typed with Enter. The server owns resolution
   * (uuid → email → nick, refusing ambiguity with candidates), so this card
   * never guesses: a 409 renders as a choice, and picking one re-asks by uuid.
   */
  const { t, locale } = useI18n()
  const { can } = usePermissions()
  const canBanWrite = computed(() => can('bans:write'))

  const search = usePlayerSearch()
  const identifier = ref<string | null>(null)
  /** What the identifier was picked AS — suggestions hide until the query moves again. */
  const pickedQuery = ref('')

  // The hop from another admin screen: ?u=<identifier> opens the card as if
  // it had been submitted here.
  const route = useRoute()
  watch(
    () => route.query.u,
    (raw) => {
      const value = Array.isArray(raw) ? raw[0] : raw
      if (typeof value === 'string' && value.trim() !== '') {
        search.query.value = value
        pickedQuery.value = value
        identifier.value = value
      }
    },
    { immediate: true }
  )

  const suggestionsShown = computed(
    () =>
      search.hits.value.length > 0 &&
      search.query.value.trim() !== '' &&
      search.query.value.trim() !== pickedQuery.value
  )

  const open = (value: string): void => {
    pickedQuery.value = value
    identifier.value = value
  }

  const pick = (name: string): void => {
    search.query.value = name
    open(name)
  }

  const onSubmit = (): void => {
    const value = search.query.value.trim()
    if (value !== '') open(value)
  }

  const pickCandidate = (candidate: AdminUser): void => {
    search.query.value = candidate.displayName
    pickedQuery.value = candidate.displayName
    identifier.value = candidate.id
  }

  const enabledOn = <T extends object>(options: T, on: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled: on
  })

  const bans = useQuery(
    computed(() =>
      enabledOn(playerBansQueryOptions(identifier.value ?? ''), identifier.value !== null)
    )
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
</script>
