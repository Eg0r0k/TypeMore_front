<template>
  <div class="bucket-picker">
    <Typography class="bucket-picker__label" tag-name="span" size="xs" color="sub">
      {{ t('boards.bucket.label') }}
    </Typography>

    <button
      type="button"
      class="bucket-picker__trigger bg-sub-alt border border-sub rounded-md transition-tm focus-ring flex h-9 cursor-pointer items-center px-3 text-sm text-text"
      data-testid="boards-bucket-picker"
      :aria-label="t('boards.bucket.label')"
      @click="open = true"
    >
      <span class="truncate">{{ selectedLabel }}</span>
    </button>

    <ConsoleModal
      v-model:open="open"
      :model-value="selected"
      :items="rows"
      search-key="label"
      :search-keys="['bucket']"
      value-key="bucket"
      :title="t('boards.bucket.label')"
      @update:model-value="onSelect"
    >
      <template #item="{ item }">
        <Typography color="primary">{{ item.label }}</Typography>
        <span class="bucket-picker__entries">
          {{ t('boards.bucket.entries', { count: item.entries }) }}
        </span>
      </template>
    </ConsoleModal>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { isQuoteBucket, type BucketInfo } from '@shared/api'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'
  import { ConsoleModal } from '@/features/modal/console'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Which board to show. Presentational: the page owns the selection (it lives
   * in the URL) and hands it down.
   *
   * Each bucket is named by the dimension its MODE gives it — seconds for
   * `time`, words for `words` — so the picker never asks a reader to know that
   * "the number" means milliseconds here and words there.
   *
   * It is a SEARCHABLE picker rather than a dropdown because the bucket list is
   * a function of the corpus, and the corpus is now 430 languages. A board
   * exists for every (mode, dimension, language) anyone has played, plus one per
   * quote, so this list runs to hundreds of rows and scrolling it is not a way
   * to find anything. Search covers the label AND the raw bucket key, so a URL
   * someone pasted is findable by the string they have in hand.
   */
  const props = defineProps<{
    buckets: readonly BucketInfo[]
    selected: string
  }>()

  const emit = defineEmits<{ (e: 'select', bucket: string): void }>()

  const { t } = useI18n()

  // A bucket carries the language KEY it was played in; the dictionary
  // catalogue is the only thing that knows what that key is called.
  const { languageName } = useLanguageNames()

  const open = ref(false)

  const MS_PER_SECOND = 1000
  /** Enough of a uuid to tell two quote boards apart in a dropdown. */
  const QUOTE_ID_STEM = 8

  /**
   * A quote board has no mode, dimension or language to be named by — everyone
   * types the same fixed text, so it is named by the quote. The catalogue only
   * carries the id (attribution lives on the board's rows and on
   * `GET /quotes/{id}`), so the label uses a stem of it, which is at least
   * unambiguous between two quote boards.
   */
  const label = (bucket: BucketInfo): string => {
    if (isQuoteBucket(bucket)) {
      return t('boards.bucket.quote', { id: bucket.quoteId.slice(0, QUOTE_ID_STEM) })
    }
    const lang = languageName(bucket.lang)
    return bucket.mode === 'time'
      ? t('boards.bucket.time', {
          seconds: Math.round((bucket.durationMs ?? 0) / MS_PER_SECOND),
          lang
        })
      : t('boards.bucket.words', { count: bucket.wordCount ?? 0, lang })
  }

  /** One row per bucket: the key it selects, the name it shows, its size. */
  type BucketRow = { readonly bucket: string; readonly label: string; readonly entries: number }

  const rows = computed<BucketRow[]>(() =>
    props.buckets.map((bucket) => ({
      bucket: bucket.bucket,
      label: label(bucket),
      entries: bucket.entries
    }))
  )

  // The modal is portalled and unmounted while closed, so the trigger renders
  // its own copy of the label rather than relying on the selected row's node.
  const selectedLabel = computed<string>(() => {
    const current = props.buckets.find((bucket) => bucket.bucket === props.selected)
    return current === undefined ? props.selected : label(current)
  })

  const onSelect = (value: string | string[] | null): void => {
    if (typeof value === 'string' && value !== props.selected) emit('select', value)
  }
</script>

<style lang="scss" scoped>
  .bucket-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &__label {
      text-transform: uppercase;
    }

    &__entries {
      color: var(--sub-color);
    }
  }
</style>
