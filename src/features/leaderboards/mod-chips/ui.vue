<template>
  <ul v-if="chips.length > 0" class="board-mods" data-testid="boards-mods">
    <li v-for="chip in chips" :key="chip" class="board-mods__chip">{{ chip }}</li>
  </ul>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { BoardMods } from '@shared/api'

  /**
   * The mods a row was played under, as chips.
   *
   * `mods` is the RAW verifiable-mods slice of the run's setup — field
   * selection, nothing else. Turning it into labels is the CLIENT's job by
   * design (LEADERBOARDS.md): a server-side "chips" distillation would be a
   * second copy of mod semantics living in SQL and Go, and keeping it honest
   * would need goja-fenced agreement tests against the vendored bundle exactly
   * like `grade` has. A display string has no reproducible-from-Postgres
   * requirement, so it does not earn the second copy.
   *
   * Only mods that are ON become chips: `difficulty: 'normal'` and `minWpm: 0`
   * are the ABSENCE of a mod, not a mod called "normal". Labels are the game's
   * own (`game.*`) so a board says "punctuation" exactly like the test screen.
   */
  const props = defineProps<{ mods: BoardMods }>()

  const { t } = useI18n()

  /** Boolean mods, in the order the game's own settings bar lists them. */
  const FLAGS = [
    'punctuation',
    'numbers',
    'randomCase',
    'nospace',
    'blind',
    'reverse',
    'fading',
    'flashlight'
  ] as const

  const chips = computed<string[]>(() => {
    const { mods } = props
    const out: string[] = []
    if (mods.difficulty !== 'normal') out.push(t(`game.difficulty.${mods.difficulty}`))
    if (mods.minWpm > 0) out.push(`${t('game.minSpeed')} ${mods.minWpm}`)
    for (const flag of FLAGS) {
      if (mods[flag]) out.push(t(`game.${flag}`))
    }
    return out
  })
</script>

<style lang="scss" scoped>
  .board-mods {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;

    &__chip {
      padding: 0.1rem 0.5rem;
      font-size: 0.7rem;
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
