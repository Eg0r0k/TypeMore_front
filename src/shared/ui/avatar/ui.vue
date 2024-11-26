<template>
  <div class="avatar" :aria-label="`Avatar of ${username}`">
    <span class="avatar__initials initials">
      {{ initials }}
    </span>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  interface Props {
    username: string
  }
  const props = defineProps<Props>()

  const initials = computed(() => {
    return props.username
      .split(' ')
      .map((name) => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  })
</script>

<style lang="scss" scoped>
  .avatar {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100px;
    background-color: var(--sub-alt-color);
    aspect-ratio: 1/1;
    border-radius: 9999px;
    outline: 4px solid var(--main-color);

    &__initials {
      font-size: 40px !important;
    }
  }
</style>
