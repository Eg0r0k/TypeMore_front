<template>
  <div v-if="visible" class="setting-row" :class="{ 'setting-row--wide': wide }">
    <div class="setting-row__text">
      <Typography class="setting-row__label" size="s" color="primary" tag-name="p">
        {{ t(`settings.${id}.label`) }}
      </Typography>
      <Typography size="xxs" color="sub" tag-name="p">
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
   * One labelled setting: a text block (label over its explanation) and a
   * control, the two centred against each other on one line.
   *
   * The explanation used to sit on its OWN row spanning the full width, which
   * cost the row two lines of height and, because a grid item spanning `1 / -1`
   * distributes its intrinsic contribution across every track it spans, let a
   * long description inflate the control column — the description was moving the
   * dropdown. Both problems go away by keeping the text in its own column and
   * fixing the control track: nothing the label or description does can reach
   * the control, and every row (in every section — appearance renders two)
   * resolves that track identically, so the controls form one straight rail.
   *
   * The narrower text column is what pays for the centring, and the reason the
   * descriptions are one short sentence rather than a paragraph.
   *
   * `wide` is for composite controls (the background cluster, the colour
   * swatches) that are a small layout of their own: they drop below the text and
   * take the whole row instead of being crushed into the rail.
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
    gap: 10px;
    padding: 14px 0;
    border-bottom: 1px solid var(--sub-alt-color);

    &:last-child {
      border-bottom: 0;
    }

    @media (width >= 640px) {
      // The rail. Every row agrees on it, so every control lines up.
      grid-template-columns: minmax(0, 1fr) var(--setting-control-width, 220px);
      gap: 24px;
      align-items: center;
    }
  }

  .setting-row__text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .setting-row__control {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    min-width: 0;

    // Only once there IS a rail: `end` lets short controls (a switch, an icon
    // button) share their right edge with the dropdowns and sliders that fill
    // it. Single-column, the control sits under its own label, so pushing it to
    // the far side of the screen would only strand it.
    @media (width >= 640px) {
      justify-content: end;
    }
  }

  /*
   * Composite controls: text first (it explains the cluster), control block
   * below at full width. `align-items: start` because there is no longer a short
   * control to centre the text against.
   */
  .setting-row--wide {
    @media (width >= 640px) {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }

    // A full-width block has no rail to hug: it reads from the start edge,
    // under the text it belongs to.
    .setting-row__control {
      justify-content: start;
    }
  }
</style>
