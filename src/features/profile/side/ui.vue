<template>
  <div class="side-stats">
    <div
      v-for="(item, index) in props.statistics"
      :key="index"
      class="side-stats__statistic statistic"
    >
      <Typography color="sub" size="xs">{{ item.mode }}</Typography>
      <Typography color="primary" size="l">{{ item.value }}</Typography>
      <Typography color="primary" size="s">{{ item.accuracy }}</Typography>
    </div>
    <Button size="s" class="side-stats__open">•••</Button>
  </div>
</template>

<script lang="ts" setup>
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Statistic } from '@/pages/profile/ui.vue'

  const props = defineProps<{
    statistics: Statistic[]
  }>()
</script>

<style lang="scss" scoped>
  @media screen and (width <= 375px) {
    .side-stats {
      flex-direction: column;
    }
  }

  .side-stats {
    position: relative;
    display: flex;
    flex-grow: 1;
    flex-basis: 25%;
    gap: 12px;
    justify-content: space-between;
    padding: 33px 38px 61px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__open {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
    }
  }

  .statistic {
    text-align: center;
  }
</style>
