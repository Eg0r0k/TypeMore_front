<template>
  <GameModIcons :mods="mods" data-testid="boards-mods" />
</template>

<script setup lang="ts">
  import type { BoardMods } from '@shared/api'
  import { GameModIcons } from '@/entities/game'

  /**
   * The mods a row was played under, as icon chips.
   *
   * `mods` is the RAW verifiable-mods slice of the run's setup — field
   * selection, nothing else. Turning it into chips is the CLIENT's job by
   * design (LEADERBOARDS.md): a server-side "chips" distillation would be a
   * second copy of mod semantics living in SQL and Go. The projection itself
   * (what counts as ON, which glyph, which label) lives in the game entity's
   * `GameModIcons`, so a board draws a mod exactly like the settings bar does.
   */
  defineProps<{ mods: BoardMods }>()
</script>
