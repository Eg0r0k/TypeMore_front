<template>
  <button
    type="button"
    class="emoji-cell"
    :title="`:${emoji.value}:`"
    :aria-label="emoji.text"
    :data-testid="`emoji-${emoji.value}`"
    @click="emit('select')"
  >
    <!-- The icons are remote. A dead one must not leave a blank square you
         cannot identify: the name takes its place, and the cell stays pickable
         either way. -->
    <img
      v-if="!broken"
      :src="emoji.icon"
      :alt="emoji.text"
      draggable="false"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="emit('broken')"
    />
    <span v-else class="emoji-cell__fallback">{{ emoji.text.slice(0, 2) }}</span>
  </button>
</template>

<script setup lang="ts">
  import type { Emoji } from '@/shared/lib/helpers/emoji'

  /**
   * One cell of the picker grid. Its own component because the grid renders in
   * two shapes — virtualised when it overflows, a plain grid when it does not —
   * and the cell must be the same thing in both.
   */
  defineProps<{ emoji: Emoji; broken: boolean }>()
  const emit = defineEmits<{ select: []; broken: [] }>()
</script>

<style lang="scss" scoped>
  .emoji-cell {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0.25rem;
    cursor: pointer;
    border-radius: var(--border-radius, 0.375rem);
    transition: background-color var(--transition-duration, 0.125s) linear;

    &:hover {
      background-color: var(--bg-color);
    }

    &:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 1.5px var(--bg-color),
        0 0 0 3px var(--text-color);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
    }

    &__fallback {
      overflow: hidden;
      font-size: 0.6875rem;
      color: var(--sub-color);
      text-transform: lowercase;
      user-select: none;
    }
  }
</style>
