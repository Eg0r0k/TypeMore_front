<template>
  <section role="region" class="profile">
    <div class="profile__header">
      <UserStat />
    </div>
    <HeatStat />
    <SideStatsContainer />
  </section>
</template>

<script setup lang="ts">
  import { HeatStat } from '@/widgets/heatStat'
  import { SideStatsContainer } from '@/widgets/sideStat'
  import { UserStat } from '@/widgets/user'

  export interface Statistic {
    mode: string
    value: number | string | null
    accuracy: number | string | null
  }
</script>

<style lang="scss" scoped>
  @media screen and (width <= 375px) {
    .profile {
      &__header {
        flex-direction: column;
      }
    }
  }

  .profile {
    &__header {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: center;
      justify-content: space-between;
      margin: 20px 0;
      padding: 33px 38px;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
