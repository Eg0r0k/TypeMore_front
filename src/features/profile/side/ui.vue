<template>
  <div class="sideStats">
    <div
      v-for="(item, index) in props.statistics"
      :key="index"
      class="sideStats__statistic statistic"
    >
      <Typography color="sub" size="xs">{{ item.mode }}</Typography>
      <Typography color="primary" size="l">{{ item.value }}</Typography>
      <Typography color="primary" size="s">{{ item.accuracy }}</Typography>
    </div>
    <Button size="s" class="sideStats__open">•••</Button>
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
  @media screen and (max-width: 375px) {
    .sideStats {
      flex-direction: column;
    }
  }

  .sideStats {
    display: flex;
    position: relative;
    justify-content: space-between;
    gap: 12px;
    padding: 33px 38px 61px 38px;

    background-color: var(--sub-alt-color);
    flex-grow: 1;
    flex-basis: 25%;
    border-radius: var(--border-radius);

    &__open {
      position: absolute;
      bottom: 0;
      right: 0;
      left: 0;
    }
  }

  .statistic {
    text-align: center;
  }
</style>
