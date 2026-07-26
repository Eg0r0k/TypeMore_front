<template>
  <ul v-if="chips.length" class="freemod-chips">
    <li v-for="chip in chips" :key="chip.key" class="freemod-chips__chip">{{ chip.label }}</li>
  </ul>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { Freemods } from '@shared/match-transport'
  import { optionsFor, type GameOption } from '@/entities/game'

  /**
   * Compact per-seat freemod chips.
   *
   * A chip appears when a freemod differs from its default, which is the whole
   * rule: the three hand-written conditions this replaced (`difficulty !==
   * 'normal'`, `minWpm > 0`, `nospace`) were each a second copy of a default
   * already declared in the registry, and a fourth freemod would have needed a
   * fourth one written here by hand.
   */
  const props = defineProps<{ freemods: Freemods }>()
  const { t } = useI18n()

  const labelOf = (option: GameOption, value: string | number | boolean): string => {
    if (option.control.kind === 'enum') return t(`${option.valueI18nPrefix}.${value}`)
    // A magnitude reads as "min speed 80"; a flag is named by its label alone.
    return option.control.kind === 'presets' ? `${t(option.i18nKey)} ${value}` : t(option.i18nKey)
  }

  const chips = computed(() =>
    optionsFor('freemod')
      .map((option) => ({
        option,
        value: props.freemods[option.key as keyof Freemods]
      }))
      .filter(({ option, value }) => value !== option.defaultValue)
      .map(({ option, value }) => ({ key: option.key, label: labelOf(option, value) }))
  )
</script>

<style lang="scss" scoped>
  .freemod-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;

    &__chip {
      padding: 0.1rem 0.5rem;
      font-size: 0.75rem;
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
