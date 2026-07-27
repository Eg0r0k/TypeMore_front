<template>
  <div class="quote-board" data-testid="quote-board-header">
    <Link :to="routeLocation.boards()" class="quote-board__back">
      {{ t('boards.quote.back') }}
    </Link>

    <blockquote v-if="quote.data.value" class="quote-board__text">
      {{ preview }}
    </blockquote>
    <Typography v-else-if="quote.isError.value" size="s" color="sub">
      {{ t('boards.quote.unknown') }}
    </Typography>
    <Typography v-else size="s" color="sub">{{ t('boards.loading') }}</Typography>

    <Typography v-if="quote.data.value" class="quote-board__meta" size="xs" color="sub">
      <template v-if="quote.data.value.source">{{ quote.data.value.source }} ·</template>
      {{ languageName(quote.data.value.lang) }}
    </Typography>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'
  import { quoteByIdQueryOptions } from '@shared/api'
  import { routeLocation } from '@/app/router/route-locations'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'
  import { Link } from '@/shared/ui/link'
  import { Typography } from '@/shared/ui/typography'

  /**
   * What a quote board is a board OF.
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
   */
  const props = defineProps<{ quoteId: string }>()

  /** Enough of the text to recognise it; the whole quote belongs in a run, not a heading. */
  const PREVIEW_CHARS = 140

  const { t } = useI18n()
  const { languageName } = useLanguageNames()

  const quote = useQuery(computed(() => quoteByIdQueryOptions(props.quoteId)))

  const preview = computed(() => {
    const text = quote.data.value?.text ?? ''
    return text.length <= PREVIEW_CHARS ? text : `${text.slice(0, PREVIEW_CHARS).trimEnd()}…`
  })
</script>

<style lang="scss" scoped>
  .quote-board {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;

    &__back {
      align-self: flex-start;
      font-size: 0.75rem;
      color: var(--sub-color);
    }

    &__text {
      margin: 0;
      font-size: 1rem;
      line-height: 1.4;
      color: var(--text-color);
    }

    &__meta {
      display: block;
    }
  }
</style>
