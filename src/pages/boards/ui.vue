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
      v-else-if="selected === undefined"
      class="boards-page__state"
      data-testid="boards-no-boards"
      size="s"
      color="sub"
    >
      {{ t('boards.noBoards') }}
    </Typography>

    <template v-else>
      <!--
        The heading sits OUTSIDE the ranking on purpose: a board that fails to
        load must still leave the user a way to pick another one.

        Which heading depends on what KIND of board this is. A language board is
        one of a few hundred and is chosen from the picker. A quote board is one
        of ~15 800, so it is not in the picker at all — it is arrived at from
        the quote (the results screen, or a link), and what it needs is not a
        chooser but a statement of which text this ranks.
      -->
      <QuoteBoardHeader v-if="quoteId !== null" :quote-id="quoteId" />
      <BoardBucketPicker v-else :buckets="browsable" :selected="selected" @select="select" />
      <BoardView :bucket="selected" />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { bucketCatalogueQueryOptions, isQuoteBucket } from '@shared/api'
  import {
    BoardBucketPicker,
    BoardView,
    QuoteBoardHeader,
    browsableBuckets,
    useBucketSelection
  } from '@/features/leaderboards'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Leaderboards. Public, because a board nobody can read without an account is
   * a board nobody links to.
   *
   * The page owns exactly one thing the three features share: which bucket is
   * on screen. That lives in `?bucket=`, so a board is a link.
   */
  const { t } = useI18n()

  const catalogue = useQuery(bucketCatalogueQueryOptions())
  const buckets = computed(() => catalogue.data.value ?? [])

  /** What the picker offers: the language boards. */
  const browsable = computed(() => browsableBuckets(buckets.value))

  // Validated against the FULL catalogue, not against `browsable`: a quote
  // board is unlisted, not unreachable, and `?bucket=quote:<id>` has to keep
  // resolving or every link ever shared to one silently redirects.
  const { selected, select } = useBucketSelection(catalogue.data)

  /** The quote this board ranks, or `null` for a language board. */
  const quoteId = computed<string | null>(() => {
    const current = buckets.value.find((bucket) => bucket.bucket === selected.value)
    return current !== undefined && isQuoteBucket(current) ? current.quoteId : null
  })

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
