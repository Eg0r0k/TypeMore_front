<template>
  <ul v-if="chips.length" class="freemod-chips">
    <li v-for="chip in chips" :key="chip" class="freemod-chips__chip">{{ chip }}</li>
  </ul>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { Freemods } from '@shared/match-transport'

  /** Compact per-seat freemod chips: difficulty (non-normal), min-wpm floor, nospace. */
  const props = defineProps<{ freemods: Freemods }>()
  const { t } = useI18n()

  const chips = computed(() => {
    const out: string[] = []
    if (props.freemods.difficulty !== 'normal') {
      out.push(t(`game.difficulty.${props.freemods.difficulty}`))
    }
    if (props.freemods.minWpm > 0) out.push(`${t('game.minSpeed')} ${props.freemods.minWpm}`)
    if (props.freemods.nospace) out.push(t('game.nospace'))
    return out
  })
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
