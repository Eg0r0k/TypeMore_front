<template>
  <!-- TODO mb go to delete -->
  <div class="container">
    <slot></slot>
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.container {
  height: 100%;
  max-width: 1532px;
  padding: 0 16px;
  width: 100%;
  margin: 0 auto;
}
</style>
