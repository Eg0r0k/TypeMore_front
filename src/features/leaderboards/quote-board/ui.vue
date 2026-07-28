<template>
  <header class="quote-board" data-testid="quote-board-header">
    <template v-if="quote.data.value">
      <!--
        The ATTRIBUTION is the headline: a quote is someone's words, and a
        board that shows a ranking over them without saying whose is not
        something to ship (the same rule the wire format enforces — `source`
        is non-optional on a quote board's rows).
      -->
      <Typography
        class="quote-board__source"
        data-testid="quote-board-source"
        tag-name="h2"
        size="xl"
        color="primary"
      >
        {{ quote.data.value.source }}
      </Typography>

      <blockquote class="quote-board__text" data-testid="quote-board-text">
        {{ quote.data.value.text }}
      </blockquote>

      <Typography class="quote-board__meta" size="xs" color="sub">
        {{ languageName(quote.data.value.lang) }} ·
        {{ t('boards.quote.length', { count: quote.data.value.length }) }}
      </Typography>
    </template>

    <Typography v-else-if="quote.isError.value" size="s" color="sub">
      {{ t('boards.quote.unknown') }}
    </Typography>
    <Typography v-else size="s" color="sub">{{ t('boards.loading') }}</Typography>
  </header>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { quoteByIdQueryOptions } from '@shared/api'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'
  import { Typography } from '@/shared/ui/typography'

  /**
   * What a quote board is a board OF: the text in full and, above it, whose
   * words they are.
   *
   * A quote bucket carries nothing but the id (LEADERBOARDS.md: any second
   * component could only repeat what the id already determines), so the heading
   * has to resolve the text itself. `GET /quotes/{id}` is public, immutable and
   * already cached by id — the same call a finished run makes to re-read the
   * text it was played on, so on the path that matters (results → this board)
   * it costs nothing.
   *
   * A failed lookup is not a failed board: the ranking below stands on its own,
   * so an unresolvable id degrades to a line of text rather than to an error.
   * The way back is the rail: quotes is already the active source here, and
   * the length chips reopen the picker.
   */
  const props = defineProps<{ quoteId: string }>()

  const { t } = useI18n()
  const { languageName } = useLanguageNames()

  const quote = useQuery(computed(() => quoteByIdQueryOptions(props.quoteId)))
</script>

<style lang="scss" scoped>
  .quote-board {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;

    &__source {
      margin: 0;
    }

    &__text {
      margin: 0;
      padding-left: 0.75rem;
      font-size: 1rem;
      line-height: 1.5;
      color: var(--text-color);
      border-left: 2px solid var(--main-color);
    }

    &__meta {
      display: block;
    }
  }
</style>
