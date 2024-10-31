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
      <Button buttonLabel="Open profile settings" class="profile__settings" size="s" color="gray">•••</Button>
    </div>
    <div style="
        background-color: var(--sub-alt-color);
        margin-top: 20px;
        border-radius: 6px;
       padding: 33px 38px;
        display:flex; 
        gap:14px;
        justify-content:space-between;
      ">

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
  </section>
</template>

<script setup lang="ts">
import { HeatMap } from '@/features/profile/heatmap'
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
const username = ref('JohnDoe')

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
  &__header {
    display: flex;

    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
    margin-top: 20px;
    position: relative;
    background-color: var(--sub-alt-color);
    padding: 33px 38px;
    border-radius: var(--border-radius);
  }

  &__settings {
    position: absolute;
    right: 14px;
    top: 14px;
  }
}
</style>
