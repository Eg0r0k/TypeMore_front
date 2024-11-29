<template>
  <p @click="isOpen = !isOpen" class="content__label">
    <slot name="label" />
  </p>

  <div v-show="isOpen" class="devtools__content content">
    <slot></slot>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'

  const isOpen = ref(false)
</script>

<style lang="scss" scoped>
  .content {
    margin-bottom: 4px;

    &__label {
      position: relative;
      font-weight: 600 !important;

      &::after {
        content: '';
        position: absolute;
        height: 1px;
        background-color: var(--sub-color);
        top: 50%;
        transform: translateY(-50%);
        width: 100%;
      }
    }
  }
</style>
