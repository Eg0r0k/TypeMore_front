<template>
  <div v-if="visible" class="setting-row">
    <Typography class="setting-row__label" size="s" color="primary" tag-name="p">
      {{ t(`settings.${id}.label`) }}
    </Typography>
    <div class="setting-row__control">
      <slot />
    </div>
    <div class="setting-row__meta">
      <Typography size="xs" color="sub" tag-name="p">
        {{ t(`settings.${id}.description`) }}
      </Typography>
      <slot name="note" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { Typography } from '@/shared/ui/typography'
  import { SETTINGS_FILTER, type SettingId } from '../model/registry'

  /**
   * One labelled setting. Label and control share the first line; the
   * explanation runs underneath across the ROW's full width — at the old
   * two-column layout the description was squeezed into a ~46ch side column
   * and long strings stacked five lines tall, making every category a scroll.
   * The row hides itself when the dialog's search filters it out, so a
   * section never has to know about the query.
   */
  const props = defineProps<{ id: SettingId }>()

  const { t } = useI18n()
  const filter = inject(SETTINGS_FILTER, undefined)
  const visible = computed(() => !filter || filter.isVisible(props.id))
</script>

<style lang="scss" scoped>
  .setting-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 8px;
    column-gap: 32px;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid var(--sub-alt-color);

    &:last-child {
      border-bottom: 0;
    }

    @media (width >= 640px) {
      grid-template-columns: minmax(0, 1fr) auto;
      row-gap: 6px;
    }
  }

  .setting-row__control {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    min-width: 0;

    @media (width >= 640px) {
      justify-content: flex-end;
    }
  }

  // Full-row measure, capped where lines get hard to track.
  .setting-row__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 66ch;

    @media (width >= 640px) {
      grid-column: 1 / -1;
    }
  }
</style>
