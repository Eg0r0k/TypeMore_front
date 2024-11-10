<template>
  <section role="region" class="profile">
    <div class="profile__header">
      <div class="profile__user user">
        <UserAvatar :username="username" />
        <h1 class="user__username">
          <Typography color="primary" size="xl" tag="span">{{ username }}</Typography>
          <Typography color="sub" size="m" tag="span">{{ username }}</Typography>
          

        </h1>

      </div>
      <ProfileStats />
      <div class="profile__settings-wrapper">  
        <Button
          class="profile__settings-button"
          buttonLabel="•••"
          size="s"
          color="gray"
          @click="openDropDown"
          :aria-expanded="isDropdownOpen"
          aria-haspopup="true"
          aria-controls="profile-settings-dropdown"
        >
        •••
      </Button>
      
        <ul v-if="isDropdownOpen" id="profile-settings-dropdown" class="profile__settings-dropdown" role="menu" aria-labelledby="profile-settings-button">
          <li role="menuitem">
            <Typography color="primary" size="xs" tag="p">set</Typography>
          </li>
          <li role="menuitem">
            <Typography color="primary" size="xs" tag="p">get</Typography>

          </li>
          <li role="menuitem">
            <Typography color="primary" size="xs" tag="p">copy</Typography>
          </li>
        </ul>
      </div>
      </div>

    <div class="profile__heatmap-container">

      <HeatMap :year="year" />
      <Select 
      label="Select year" 
      style="max-width:100px; margin-bottom:10px;" 
      :tabindex="-1"
      :options="years" 
      :default="year.toString()" 
      @input="updateYear" 
        />
    </div>
    <div class="profile__side-container">
      <SideStats :statistics="firstFourStats" />
      <SideStats :statistics="secondFourStats" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { HeatMap } from '@/features/profile/heatmap'
import { SideStats } from '@/features/profile/side'
import { ProfileStats } from '@/features/profile/stats'
import { UserAvatar } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { Typography } from '@/shared/ui/typography'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
const currentYear = dayjs().year();
const years = computed(() => [currentYear.toString(), (currentYear - 1).toString()]);
const year = ref<number>(currentYear);
function updateYear(selectedYear: string) {
  year.value = Number(selectedYear);
}
const isDropdownOpen = ref(false); 
const username = ref('JohnDoe')
const openDropDown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
}

export interface Statistic {
  mode: string;
  value: number | string | null;
  accuracy: number | string | null; 
}
const allStatistics: Statistic[] = [
  { mode: '15 seconds', value: 123, accuracy: 100 },
  { mode: '30 seconds', value: 15, accuracy: 100 },
  { mode: '60 seconds', value: null, accuracy: null },
  { mode: '120 seconds', value: 123, accuracy: 100 },
  { mode: '10 words', value: 45, accuracy: 75 },
  { mode: '30 words', value: null, accuracy: null }, 
  { mode: '60 words', value: 98, accuracy: 50 },
  { mode: '100 words', value: 62, accuracy: 25 },
];
const firstFourStats = computed(() => {
  return prepareStats(allStatistics.slice(0, 4));
});

const secondFourStats = computed(() => {
  return prepareStats(allStatistics.slice(4, 8));
});
function prepareStats(stats: Statistic[]): Statistic[] {
  return stats.map((stat) => ({
    mode: stat.mode,
    value: stat.value ?? '-', 
    accuracy: stat.accuracy != null ? `${stat.accuracy}%` : '-',
  }));
}
</script>

<style lang="scss" scoped>
.user {
  display: flex;
  align-items: center;
  gap: 32px;

  &__username {
    margin: 10px;
  }
}
@media screen and (max-width: 784px) {
.profile{
  &__side-container{
    flex-direction: column;
  }
}
  
}

@media screen and (max-width: 375px) {
  .user {
    flex-direction: column;
  }

  .profile {
    &__header {
      flex-direction: column;
    }
  }
}

.profile {
  &__settings-wrapper {
    position: absolute;
    right: 14px;
    top: 14px;
  }
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
  &__heatmap-container{
    background-color: var(--sub-alt-color);

    border-radius: var(--border-radius);
    padding: 33px 38px;
    display:flex; 
    gap:14px;
    justify-content:space-between;
    margin-bottom: 20px;
  }
  &__side-container{
    display: flex;
    gap: 20px;

  }
   &__settings-dropdown {
    position: absolute;
    right: 0; 
    top: 100%;
    background-color: var(--sub-alt-color);
    outline: 2px solid var(--sub-color); 
    border-radius: 4px;
    list-style: none;
    padding: 4px 0;
    margin: 0;
    z-index: 10; 
    min-width: 120px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    li {
      padding: 4px 16px;

      &:hover {
        background-color: var(--bg-color);
      }
    }
  }
}

</style>
