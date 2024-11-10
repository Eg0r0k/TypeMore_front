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
@media screen and (max-width: 375px) {

  .profile {
    &__header {
      flex-direction: column;
    }
  }
}

.profile {

  &__header {
    display: flex;

    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
    margin: 20px 0;
    position: relative;
    background-color: var(--sub-alt-color);
    padding: 33px 38px;
    border-radius: var(--border-radius);
  }




}
</style>
