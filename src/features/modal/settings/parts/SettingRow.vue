<template>
  <div v-if="visible" class="setting-row">
    <div class="setting-row__text">
      <Typography size="m" color="primary" tag-name="p">{{ t(`settings.${id}.label`) }}</Typography>
      <Typography size="xs" color="sub" tag-name="p">
        {{ t(`settings.${id}.description`) }}
      </Typography>
      <slot name="note" />
    </div>
    <div class="setting-row__control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { Typography } from '@/shared/ui/typography'
  import { SETTINGS_FILTER, type SettingId } from '../model/registry'

  /**
   * One labelled setting: name + explanation on the left, the control on the
   * right. The row hides itself when the dialog's search filters it out, so a
   * section never has to know about the query.
   */
  const props = defineProps<{ id: SettingId }>()

  const { t } = useI18n()
  const filter = inject(SETTINGS_FILTER, undefined)
  const visible = computed(() => !filter || filter.isVisible(props.id))
</script>

<style lang="scss" scoped>
  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 0;
    border-bottom: 1px solid var(--sub-alt-color);

    &:last-child {
      border-bottom: 0;
    }

    @media (width >= 640px) {
      flex-direction: row;
      gap: 32px;
      align-items: flex-start;
      justify-content: space-between;
    }
  }

  .setting-row__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 46ch;
  }

  .setting-row__control {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    @media (width >= 640px) {
      justify-content: flex-end;
      min-width: 220px;
    }
  }
</style>
