<template>
  <Typography
    class="my-rank"
    data-testid="boards-my-rank"
    tag-name="p"
    size="s"
    :color="entry === null ? 'sub' : 'main'"
  >
    {{ entry === null ? t('boards.notRanked') : t('boards.yourRank', { rank: entry.rank }) }}
  </Typography>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { BoardEntry } from '@shared/api'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The caller's own standing on this board. Presentational: `null` means the
   * server answered `204` — "asked, you hold no visible slot here" — which is a
   * successful answer and reads as such, never as a failure. Whether the strip
   * appears AT ALL (a signed-out visitor's `401` hides it) is the page's
   * decision, made in `useOwnRank`.
   */
  defineProps<{ entry: BoardEntry | null }>()

  const { t } = useI18n()
</script>

<style lang="scss" scoped>
  .my-rank {
    padding: 0.25rem 0.5rem;
  }
</style>
