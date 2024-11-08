<template>
    <div class="sideStats">
        <div v-for="(item, index) in statistics" :key="index" class="sideStats__statistic statistic">
      <Typography color="sub" size="s">{{ item.mode }}</Typography>
      <Typography color="primary" size="xl">{{ item.value }}</Typography>
      <Typography color="primary" size="m">{{ item.accuracy }}</Typography>
    </div>
      <Button size="s" class="sideStats__open" >
    •••
      </Button>
    </div>
  </template>
  
  <script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { Button } from '@/shared/ui/button';
  import { Typography } from '@/shared/ui/typography';
import { Statistic } from '@/pages/profile/ui.vue';
  

  const props = defineProps<{
    statistics: Statistic[];
  }>();
  

  
  
  
  </script>

<style lang="scss" scoped>
.sideStats{
    display: flex;
    position: relative;
    justify-content: space-between;
    gap: 12px;
    padding: 33px 19px 61px 19px;
    
    background-color: var(--sub-alt-color);
    flex-grow: 1;
    
    border-radius: var(--border-radius);
    &__open{
        position: absolute;
        bottom: 0;
        right: 0;
        left: 0;
    }

}
.statistic{
    text-align: center;
}
</style>