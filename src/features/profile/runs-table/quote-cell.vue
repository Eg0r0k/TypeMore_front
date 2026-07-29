<template>
  <RouterLink
    class="block max-w-56 whitespace-nowrap text-main no-underline hover:underline"
    :to="board"
    :title="quote.data.value?.text"
    data-testid="profile-run-quote-link"
  >
    <span class="block truncate" data-testid="profile-run-quote-text">{{ label }}</span>
  </RouterLink>
  <span
    v-if="quote.data.value"
    class="block text-xs text-sub"
    data-testid="profile-run-quote-group"
  >
    {{ t(`game.quote.group.${quote.data.value.lenGroup}`) }}
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useQuery } from '@tanstack/vue-query'

  import { quoteByIdQueryOptions } from '@shared/api'
  import { routeLocation } from '@/shared/router'

  /**
   * The MODE cell of a quote run's history row: the quote itself, truncated,
   * with its length band underneath — in place of the "30s" / "50 words" a
   * seeded run shows there. A quote run has no duration and no word count by
   * contract (RUNS.md, "Dimensions"), so the columns those numbers would occupy
   * are the ones the text belongs in.
   *
   * It resolves the text itself through `GET /quotes/{id}`, which is public,
   * immutable and cached BY ID — so a page of runs on the same quote costs one
   * request, and the run summary does not have to carry a copy of a text the
   * registry already serves. (The alternative, lifting the text into the runs
   * query, would put a join into the profile page's hot query — see RUNS.md,
   * "List response".)
   *
   * A row is drawn either way: the ranking, the grade and the link do not depend
   * on the text loading, so an unresolvable id degrades to the word "quote"
   * rather than to an error. Truncation is CSS, not a slice — the full text is
   * the link's title, and a slice would cut mid-grapheme.
   */
  const props = defineProps<{ quoteId: string; fallback: string }>()

  const { t } = useI18n()
  const quote = useQuery(computed(() => quoteByIdQueryOptions(props.quoteId)))

  const board = computed(() => routeLocation.boards(`quote:${props.quoteId}`))
  const label = computed(() => quote.data.value?.text ?? props.fallback)
</script>
