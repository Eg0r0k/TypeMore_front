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
      An empty catalogue is a real 200: no bucket anywhere holds a visible
      entry. Not a failure, and not something a spinner will fix.
    -->
    <Typography
      v-else-if="buckets.length === 0"
      class="boards-page__state"
      data-testid="boards-no-boards"
      size="s"
      color="sub"
    >
      {{ t('boards.noBoards') }}
    </Typography>

    <template v-else-if="selected !== undefined">
      <!--
        The picker sits OUTSIDE the ranking on purpose: a board that fails to
        load must still leave the user a way to pick another one.
      -->
      <BoardBucketPicker :buckets="buckets" :selected="selected" @select="select" />
      <BoardView :bucket="selected" />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { bucketCatalogueQueryOptions } from '@shared/api'
  import { BoardBucketPicker, BoardView, useBucketSelection } from '@/features/leaderboards'
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

  const { selected, select } = useBucketSelection(catalogue.data)

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
