<template>
  <div class="bucket-picker">
    <Typography class="bucket-picker__label" tag-name="span" size="xs" color="sub">
      {{ t('boards.bucket.label') }}
    </Typography>
    <Select :model-value="selected" @update:model-value="onSelect">
      <SelectTrigger
        class="bucket-picker__trigger"
        data-testid="boards-bucket-picker"
        :aria-label="t('boards.bucket.label')"
      >
        <SelectValue :placeholder="t('boards.bucket.label')">{{ selectedLabel }}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="bucket in buckets" :key="bucket.bucket" :value="bucket.bucket">
          {{ label(bucket) }}
          <span class="bucket-picker__entries">
            {{ t('boards.bucket.entries', { count: bucket.entries }) }}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { BucketInfo } from '@shared/api'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Which board to show. Presentational: the page owns the selection (it lives
   * in the URL) and hands it down.
   *
   * Each bucket is named by the dimension its MODE gives it — seconds for
   * `time`, words for `words` — so the picker never asks a reader to know that
   * "the number" means milliseconds here and words there.
   */
  const props = defineProps<{
    buckets: readonly BucketInfo[]
    selected: string
  }>()

  const emit = defineEmits<{ (e: 'select', bucket: string): void }>()

  const { t } = useI18n()

  const MS_PER_SECOND = 1000

  const label = (bucket: BucketInfo): string =>
    bucket.mode === 'time'
      ? t('boards.bucket.time', {
          seconds: Math.round((bucket.durationMs ?? 0) / MS_PER_SECOND),
          lang: bucket.lang
        })
      : t('boards.bucket.words', { count: bucket.wordCount ?? 0, lang: bucket.lang })

  // The listbox is portaled, so the trigger renders its own copy of the label
  // rather than relying on the selected item's node being in the tree.
  const selectedLabel = computed<string>(() => {
    const current = props.buckets.find((bucket) => bucket.bucket === props.selected)
    return current === undefined ? props.selected : label(current)
  })

  const onSelect = (value: unknown): void => {
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
