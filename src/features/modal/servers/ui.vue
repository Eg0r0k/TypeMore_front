<template>
  <ConsoleModal>
    <template #items="{ filteredItems, focusedItems, selectItem }">
      <div
        v-for="(lang, index) in filteredItems"
        :key="index"
        class="lang"
        :class="{
          focused: index === focusedItems
        }"
        @click="selectItem(lang)"
      >
        121
      </div>
    </template>
  </ConsoleModal>
</template>

<script setup lang="ts">
  import { ConsoleModal } from '../console'
</script>
