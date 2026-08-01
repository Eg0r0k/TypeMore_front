<template>
  <div v-if="visible" class="setting-row" :class="{ 'setting-row--wide': wide }">
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
   * One labelled setting: label and control share the first line, the
   * explanation runs underneath across the row's full width.
   *
   * The control column is a FIXED track, and that is the whole trick. It used to
   * be `auto`, which made the layout unstable in two ways at once:
   *
   *   - a grid item spanning `1 / -1` distributes its intrinsic contribution
   *     across every track it spans, so a long description literally inflated
   *     the `auto` control column — the description was moving the dropdown;
   *   - each row being its own grid, an `auto` track resolved to a different
   *     width per row, so no two controls in a category started at the same x.
   *
   * A fixed track is immune to both: it cannot be inflated by a spanning item,
   * and every row (in every section — appearance renders two of them) resolves
   * it identically, so the controls form one straight rail. Descriptions keep
   * the full-row measure they were given when the old two-column layout was
   * dropped for squeezing them into a ~46ch side column.
   *
   * `wide` is for composite controls (the background cluster, the colour
   * swatches) that are a small layout of their own: they drop below the
   * description and take the whole row instead of being crushed into the rail.
   *
   * The row hides itself when the dialog's search filters it out, so a section
   * never has to know about the query.
   */
  const props = defineProps<{ id: SettingId; wide?: boolean }>()

  const { t } = useI18n()
  const filter = inject(SETTINGS_FILTER, undefined)
  const visible = computed(() => !filter || filter.isVisible(props.id))
</script>

<style lang="scss" scoped>
  .setting-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px 32px;
    padding: 14px 0;
    border-bottom: 1px solid var(--sub-alt-color);

    &:last-child {
      border-bottom: 0;
    }

    @media (width >= 640px) {
      // The rail. Every row agrees on it, so every control lines up.
      grid-template-columns: minmax(0, 1fr) var(--setting-control-width, 200px);
      gap: 6px 32px;
      align-items: center;
    }
  }

  .setting-row__label {
    @media (width >= 640px) {
      grid-row: 1;
      grid-column: 1;
    }
  }

  .setting-row__control {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    min-width: 0;

    @media (width >= 640px) {
      grid-row: 1;
      grid-column: 2;
    }
  }

  // Full-row measure, capped where lines get hard to track.
  .setting-row__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 66ch;

    @media (width >= 640px) {
      grid-row: 2;
      grid-column: 1 / -1;
    }
  }

  /*
   * Composite controls: description first (it explains the cluster), control
   * block last and full width. `align-items: start` because there is no longer a
   * short control to centre against the label.
   */
  .setting-row--wide {
    @media (width >= 640px) {
      grid-template-columns: minmax(0, 1fr);
      align-items: start;

      .setting-row__label,
      .setting-row__meta,
      .setting-row__control {
        grid-column: 1;
      }

      .setting-row__label {
        grid-row: 1;
      }

      .setting-row__meta {
        grid-row: 2;
      }

      .setting-row__control {
        grid-row: 3;
        margin-top: 4px;
      }
    }
  }
</style>
