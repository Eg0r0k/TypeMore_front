<template>
  <section class="player-search" :aria-label="t('friends.search.label')">
    <SearchBar v-model="search.query.value" :placeholder="t('friends.search.placeholder')" />

    <!--
      One live region for every outcome, so a screen reader is told what the
      search did without the results list having to be focused. `polite`: the
      player is typing, and interrupting them mid-word is the one thing an
      assertive region would be worse at.
    -->
    <p
      class="player-search__status"
      role="status"
      aria-live="polite"
      data-testid="player-search-status"
    >
      <template v-if="search.state.value === 'too-short'">
        {{ t('friends.search.tooShort', { min: search.minLength }) }}
      </template>
      <template v-else-if="search.state.value === 'searching'">
        {{ t('friends.search.searching') }}
      </template>
      <template v-else-if="search.state.value === 'empty'">
        {{ t('friends.search.empty', { query: search.query.value.trim() }) }}
      </template>
      <template v-else-if="search.state.value === 'error'">
        <Typography tag-name="span" size="s" color="error">
          {{ search.errorMessage.value ?? t('friends.search.error') }}
        </Typography>
      </template>
      <template v-else-if="search.state.value === 'results'">
        {{ t('friends.search.found', search.hits.value.length) }}
      </template>
    </p>

    <!--
      Stale hits stay on screen while a refinement is in flight (dimmed, not
      removed): blanking the list on every keystroke is what makes a search box
      feel broken. `aria-busy` says the same thing without the dimming.
    -->
    <ul
      v-if="search.hits.value.length > 0"
      class="player-search__results"
      :class="{ 'player-search__results--busy': search.refreshing.value }"
      :aria-busy="search.refreshing.value"
      data-testid="player-search-results"
    >
      <li v-for="hit in search.hits.value" :key="hit.name" class="player-search__row">
        <Link
          :to="routeLocation.user(hit.name)"
          class="player-search__link"
          data-testid="player-search-hit"
        >
          <span class="player-search__name">{{ hit.name }}</span>
          <!--
            A CLOSED profile is listed, marked, and still a link — the server
            returns it on purpose (finding a profile is not reading one), and
            hiding it would mean a player looking for someone who closed their
            profile is told that nobody by that name exists. The page they land
            on renders the closed state itself.
          -->
          <Typography
            v-if="!hit.public"
            tag-name="span"
            size="xs"
            color="sub"
            class="player-search__closed"
            data-testid="player-search-closed"
          >
            {{ t('friends.search.closed') }}
          </Typography>
          <Typography tag-name="span" size="xs" color="sub" class="player-search__joined">
            {{ t('friends.search.joined', { date: joinedOn(hit.joined) }) }}
          </Typography>
        </Link>
      </li>
    </ul>

    <!--
      The server has no cursor here on purpose — a search is refined, not paged
      — so a full page of hits gets a nudge to narrow the query rather than a
      "load more" that cannot exist.
    -->
    <Typography
      v-if="search.hits.value.length >= SEARCH_PAGE_SIZE"
      size="xs"
      color="sub"
      class="player-search__refine"
    >
      {{ t('friends.search.refine') }}
    </Typography>
  </section>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import dayjs from 'dayjs'

  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'
  import { Link } from '@/shared/ui/link'
  import { routeLocation } from '@/shared/router'

  import { usePlayerSearch } from './model/use-player-search'

  /**
   * Find a player by (part of) their name and open their public profile.
   *
   * Everything about the request's shape is the server's: 3–20 characters, no
   * cursor, closed profiles included. See `searchUsers` for why each of those
   * is what it is; this component only renders the consequences.
   */
  const { t } = useI18n()
  const search = usePlayerSearch()

  /** The server's default `limit` — one full page means "ask something narrower". */
  const SEARCH_PAGE_SIZE = 20

  const joinedOn = (iso: string): string => dayjs(iso).format('MMM YYYY')
</script>

<style scoped lang="scss">
  .player-search {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
  }

  .player-search__status {
    min-height: 1.25rem;
    font-size: 0.875rem;
    color: var(--sub-color);
  }

  .player-search__results {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    transition: opacity var(--transition-duration);

    // A refinement is in flight: the hits under it are the PREVIOUS query's.
    &--busy {
      opacity: 0.55;
    }
  }

  .player-search__link {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border-radius: var(--roundness, 0.5rem);
    transition:
      background-color var(--transition-duration),
      color var(--transition-duration);

    &:hover,
    &:focus-visible {
      background-color: var(--sub-alt-color);
    }
  }

  .player-search__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // Pushed to the trailing edge so the row scans as "who / when", with the
  // closed mark sitting with the name it qualifies.
  .player-search__joined {
    margin-inline-start: auto;
    white-space: nowrap;
  }

  .player-search__closed {
    padding: 0 0.375rem;
    white-space: nowrap;
    border: 1px solid var(--sub-color);
    border-radius: var(--roundness, 0.5rem);
  }
</style>
