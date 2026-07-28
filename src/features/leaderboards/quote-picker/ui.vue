<template>
  <div class="quote-picker" data-testid="quote-picker">
    <Typography v-if="isLoading" class="quote-picker__state" size="s" color="sub">
      {{ t('boards.loading') }}
    </Typography>

    <template v-else>
      <ul v-if="quotes.length > 0" class="quote-picker__rows">
        <li v-for="quote in quotes" :key="quote.id">
          <!--
            The row shows METADATA only — the index never carries the text
            (QUOTES.md: `ListQuotes` does not select the column). The text is
            the quote page's job, where it is typed and attributed in full.
          -->
          <button
            type="button"
            class="quote-picker__row"
            data-testid="quote-picker-row"
            @click="emit('pick', quote.id)"
          >
            <span class="quote-picker__source">{{ quote.source }}</span>
            <span class="quote-picker__meta">
              <span class="quote-picker__group">{{ t(`game.quote.group.${quote.lenGroup}`) }}</span>
              <span class="quote-picker__length">
                {{ t('boards.quote.length', { count: quote.length }) }}
              </span>
            </span>
          </button>
        </li>
      </ul>

      <Typography
        v-else-if="!isError"
        class="quote-picker__state"
        data-testid="quote-picker-empty"
        size="s"
        color="sub"
      >
        {{ t('boards.quote.pickerEmpty') }}
      </Typography>

      <div v-if="isError" class="quote-picker__error">
        <Typography data-testid="quote-picker-error" size="s" color="error">
          {{ t('boards.quote.pickerError') }}
        </Typography>
        <Button data-testid="quote-picker-retry" color="gray" size="s" @click="retry">
          {{ t('boards.retry') }}
        </Button>
      </div>

      <Button
        v-else-if="hasMore"
        class="quote-picker__more"
        data-testid="quote-picker-more"
        color="gray"
        size="s"
        :disabled="isLoadingMore"
        @click="loadMore"
      >
        {{ isLoadingMore ? t('boards.loading') : t('boards.more') }}
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { toRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { useQuoteFeed } from '../model/use-quote-feed'
  import type { QuoteGroupFilter } from '../model/use-boards-selection'

  /**
   * The quote picker: the paged quote index for a language, filtered by the
   * rail's length group. Picking one emits the id; the page turns it into the
   * quote board's address (`quoteBucketKey` — the one sanctioned mirror of the
   * server's key format).
   */
  const props = defineProps<{
    lang?: string
    group: QuoteGroupFilter
  }>()

  const emit = defineEmits<{ (e: 'pick', quoteId: string): void }>()

  const { t } = useI18n()

  const { quotes, isLoading, isLoadingMore, isError, hasMore, loadMore, retry } = useQuoteFeed(
    toRef(props, 'lang'),
    toRef(props, 'group')
  )
</script>

<style lang="scss" scoped>
  .quote-picker {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;

    &__state {
      display: block;
      padding: 1.5rem 0.5rem;
    }

    &__rows {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__row {
      display: flex;
      gap: 0.75rem;
      align-items: baseline;
      justify-content: space-between;
      width: 100%;
      padding: 0.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      color: var(--text-color);
      text-align: start;
      background: none;
      border: none;
      border-top: 1px solid var(--sub-alt-color);
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background-color: var(--sub-alt-color);
      }
    }

    &__source {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &__meta {
      display: flex;
      flex-shrink: 0;
      gap: 0.5rem;
      align-items: baseline;
    }

    &__group {
      padding: 0.1rem 0.5rem;
      font-size: 0.7rem;
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__length {
      font-size: 0.75rem;
      color: var(--sub-color);
    }

    &__error {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      padding: 0.5rem;
    }

    &__more {
      align-self: center;
    }
  }
</style>
