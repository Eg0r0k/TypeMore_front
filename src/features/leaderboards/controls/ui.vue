<template>
  <div class="board-controls" role="toolbar" :aria-label="t('boards.controls.label')">
    <button
      type="button"
      class="board-controls__button"
      data-testid="boards-to-top"
      :aria-label="t('boards.controls.top')"
      :title="t('boards.controls.top')"
      @click="emit('top')"
    >
      <IconCrown />
    </button>

    <button
      v-if="canJumpToSelf"
      type="button"
      class="board-controls__button"
      data-testid="boards-to-me"
      :aria-label="t('boards.controls.me')"
      :title="t('boards.controls.me')"
      @click="emit('me')"
    >
      <IconUser />
    </button>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import IconCrown from '~icons/tabler/crown'
  import IconUser from '~icons/tabler/user'

  /**
   * The controls strip: crown = back to rank 1, person = jump to my row. The
   * person only renders when the caller HOLDS a row here — a jump to nowhere
   * is not an affordance. There is deliberately no "next update in" timer:
   * the projection is transactional (LEADERBOARDS.md — the board cell is
   * written in the replay worker's own transaction), so the board is live by
   * construction and has no update to count down to.
   */
  defineProps<{ canJumpToSelf: boolean }>()

  const emit = defineEmits<{ (e: 'top'): void; (e: 'me'): void }>()

  const { t } = useI18n()
</script>

<style lang="scss" scoped>
  .board-controls {
    display: flex;
    gap: 0.25rem;
    align-items: center;

    &__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      font-size: 1rem;
      color: var(--sub-color);
      background: none;
      border: none;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition:
        color var(--transition-duration) ease,
        background-color var(--transition-duration) ease;

      &:hover,
      &:focus-visible {
        color: var(--main-color);
        background-color: var(--sub-alt-color);
      }
    }
  }
</style>
