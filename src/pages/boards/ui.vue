<template>
  <div class="boards-page">
    <Typography class="boards-page__title" tag-name="h1" size="xxl" color="primary">
      {{ t('boards.title') }}
    </Typography>

    <Typography v-if="catalogue.isPending.value" class="boards-page__state" size="s" color="sub">
      {{ t('boards.loading') }}
    </Typography>

    <div v-else-if="catalogue.isError.value" class="boards-page__error">
      <Typography data-testid="boards-error" size="s" color="error">
        {{ t('boards.error') }}
      </Typography>
      <Button data-testid="boards-retry" color="gray" size="s" @click="retryCatalogue">
        {{ t('boards.retry') }}
      </Button>
    </div>

    <!--
      Nothing to show is a real 200: either no bucket anywhere holds a visible
      entry, or the only ones that do are quote boards nobody asked for by id.
      Not a failure, and not something a spinner will fix.
    -->
    <Typography
      v-else-if="selected === undefined && view === 'no-language-boards' && !hasAnyBoard"
      class="boards-page__state"
      data-testid="boards-no-boards"
      size="s"
      color="sub"
    >
      {{ t('boards.noBoards') }}
    </Typography>

    <div v-else class="boards-page__layout">
      <!--
        The rail stays up whatever happens to the board on its right: a board
        that fails to load must still leave the user a way to pick another one.
      -->
      <BoardRail
        :languages="languages"
        :variations="variations"
        :language="language"
        :source="source"
        :group="group"
        :selected-bucket="selected"
        @select-language="selectLanguage"
        @select-source="selectSource"
        @select-variation="select"
        @select-group="selectGroup"
      />

      <div class="boards-page__main">
        <template v-if="view === 'board' && selected !== undefined">
          <!--
            A quote board's heading is not a chooser but a statement of which
            text this ranks — the attribution is the headline of the page.
          -->
          <QuoteBoardHeader v-if="quoteId !== null" :quote-id="quoteId" />
          <BoardView :bucket="selected" :entries-total="selectedEntries" />
        </template>

        <QuotePicker
          v-else-if="view === 'quote-picker'"
          :lang="language"
          :group="group"
          @pick="openQuoteBoard"
        />

        <!-- A language with no boards yet: the muted chips say which shapes exist. -->
        <Typography
          v-else
          class="boards-page__state"
          data-testid="boards-language-empty"
          size="s"
          color="sub"
        >
          {{ t('boards.rail.languageEmpty') }}
        </Typography>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import {
    bucketCatalogueQueryOptions,
    dictionaryCatalogueQueryOptions,
    isQuoteBucket,
    quoteBucketKey,
    quoteByIdQueryOptions,
    quoteIdOfBucketKey
  } from '@shared/api'
  import {
    BoardRail,
    BoardView,
    QuoteBoardHeader,
    QuotePicker,
    railLanguages,
    railVariations,
    useBoardsSelection
  } from '@/features/leaderboards'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Leaderboards. Public, because a board nobody can read without an account is
   * a board nobody links to.
   *
   * The page owns what crosses its features: which board is on screen, which
   * language/source/filter the rail highlights. All of it lives in the URL
   * (`useBoardsSelection`), so every state of this page is a link.
   */
  const { t } = useI18n()

  const route = useRoute()

  const catalogue = useQuery(bucketCatalogueQueryOptions())
  const buckets = computed(() => catalogue.data.value ?? [])

  // The rail names languages with the dictionary catalogue's display names —
  // the only place a key like `code_css` is named. Boards for a language the
  // catalogue no longer serves keep their key as a fallback name.
  const dictionaries = useQuery(dictionaryCatalogueQueryOptions())

  /**
   * The quote this board ranks, or `null` for a language board — read off the
   * KEY, never looked up in the catalogue. The catalogue only lists boards
   * with a visible entry, and a freshly played quote's board is exactly the
   * board that is not in it yet: deriving the id from a catalogue row was the
   * second half of the bug that made a quote link render a language board.
   */
  const quoteId = computed<string | null>(() =>
    typeof route.query.bucket === 'string' ? quoteIdOfBucketKey(route.query.bucket) : null
  )

  /**
   * Attach `enabled` while keeping the options type INTACT — a literal spread
   * collapses the `queryOptions()` intersection and vue-query's overloads
   * reject the result (same note as the replay page's `gatedBy`).
   */
  const gatedBy = <T extends object>(options: T, enabled: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled
  })

  // Resolved for the RAIL (which language row a quote board lights up); the
  // header resolves the same id through the same cache entry for its text.
  const quote = useQuery(
    computed(() => gatedBy(quoteByIdQueryOptions(quoteId.value ?? ''), quoteId.value !== null))
  )
  const quoteLang = computed(() => quote.data.value?.lang)

  const {
    selected,
    view,
    language,
    source,
    group,
    select,
    selectLanguage,
    selectSource,
    selectGroup
  } = useBoardsSelection(catalogue.data, quoteLang)

  const hasAnyBoard = computed(() => buckets.value.some((bucket) => !isQuoteBucket(bucket)))

  const languages = computed(() => railLanguages(buckets.value, dictionaries.data.value))
  const variations = computed(() => railVariations(buckets.value, language.value))

  /** A picked quote becomes its board's address — the one sanctioned mirror. */
  const openQuoteBoard = (id: string): void => {
    select(quoteBucketKey(id))
  }

  /** The visible entry count of the board on screen — the percentile's denominator. */
  const selectedEntries = computed<number | undefined>(
    () => buckets.value.find((bucket) => bucket.bucket === selected.value)?.entries
  )

  const retryCatalogue = (): void => {
    void catalogue.refetch()
  }
</script>

<style lang="scss" scoped>
  .boards-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;

    &__title {
      margin-bottom: 0;
    }

    &__layout {
      display: grid;
      grid-template-columns: 15rem minmax(0, 1fr);
      gap: 1rem;
      align-items: start;

      @media (width <= 800px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
    }

    &__state {
      display: block;
      padding: 1.5rem 0.5rem;
    }

    &__error {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  }
</style>
