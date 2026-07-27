<template>
  <div v-if="options.length" class="mod-group">
    <Typography size="xs" color="sub" class="mod-group__label">{{ label }}</Typography>
    <ToggleGroup
      type="multiple"
      :model-value="[...active]"
      :aria-label="groupAriaLabel"
      @update:model-value="onUpdate"
    >
      <ToggleGroupItem
        v-for="option in options"
        :key="option.key"
        :value="option.key"
        :disabled="reasonOf(option) !== null"
        :aria-label="t(option.i18nKey)"
        :title="titleOf(option)"
      >
        <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import { OPTION_ICONS } from '../../config/icons'
  import type { GameOption } from '../../config/registry'

  /**
   * A labelled group of boolean mods, drawn as icons alone.
   *
   * The room panel renders three of these — the host's text mods, the seat's
   * freemods and its local view mods — and each writes somewhere different, so
   * the component owns no state: `active` in, a new active list out. The solo bar
   * draws its own mods with labels beside the glyphs, because a single-column bar
   * has the room for words and a room's three stacked groups do not.
   *
   * It lives in `entities/game` rather than in `features/room` so the glyphs come
   * from the registry's `OPTION_ICONS` on every surface, by construction rather
   * than by two files agreeing.
   *
   * ICON-ONLY needs an accessible name, and gets two: `aria-label` for a screen
   * reader and `title` for a pointer. The `title` also carries the disabled
   * reason when there is one, so a greyed-out mod still explains itself on the
   * surface where there is no room to print the explanation.
   */
  const props = defineProps<{
    /** The mods in this group. Booleans only — anything else has a value to show. */
    options: readonly GameOption[]
    /** Keys currently on. */
    active: readonly string[]
    /** Group heading (what these mods affect). */
    label: string
    /** Accessible name of the group itself. Not `ariaLabel`: that name collides
     * with the plain HTML attribute and never reaches the prop. */
    groupAriaLabel: string
    /** i18n key of why an option cannot be toggled right now, or `null`. */
    disabledReason?: (option: GameOption) => string | null
  }>()

  const emit = defineEmits<{ (event: 'update:active', keys: string[]): void }>()

  const { t } = useI18n()

  const reasonOf = (option: GameOption): string | null => props.disabledReason?.(option) ?? null

  const titleOf = (option: GameOption): string => {
    const reason = reasonOf(option)
    return reason === null ? t(option.i18nKey) : `${t(option.i18nKey)} — ${t(reason)}`
  }

  /**
   * A gated mod keeps its stored value: a disabled item can never appear in the
   * incoming selection, and writing that absence back would silently clear a
   * setting the player never touched — so switching away from a quote restores
   * the mods it had greyed out.
   */
  const onUpdate = (value: unknown): void => {
    const next = new Set(Array.isArray(value) ? (value as string[]) : [])
    const keys = props.options
      .filter((option) =>
        reasonOf(option) === null ? next.has(option.key) : props.active.includes(option.key)
      )
      .map((option) => option.key)
    emit('update:active', keys)
  }
</script>

<style lang="scss" scoped>
  .mod-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &__label {
      white-space: nowrap;
    }
  }
</style>
