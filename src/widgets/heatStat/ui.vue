<template>
  <div class="heatmap-container">
    <HeatMap :year="year" />
    <Select
      label="Select year"
      style="max-width: 100px; margin-bottom: 10px"
      :options="years"
      :default="year.toString()"
      @input="updateYear"
    />
  </div>
</template>

<script setup lang="ts">
  import { HeatMap } from '@/features/profile/heatmap'
  import { Select } from '@/shared/ui/select'
  import dayjs from 'dayjs'
  import { computed, ref } from 'vue'

  const currentYear = dayjs().year()
  const years = computed(() => [currentYear.toString(), (currentYear - 1).toString()])
  const year = ref<number>(currentYear)
  function updateYear(selectedYear: string) {
    year.value = Number(selectedYear)
  }
</script>

<style lang="scss" scoped>
  .heatmap-container {
    display: flex;
    gap: 14px;
    justify-content: space-between;
    padding: 33px 38px;
    margin-bottom: 20px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
  }
</style>
