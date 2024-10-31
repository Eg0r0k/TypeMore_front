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
      <Button buttonLabel="Open profile settings" class="profile__settings" size="s" color="gray">•••</Button>
    </div>
    <div style="
        background-color: var(--sub-alt-color);
        margin-top: 20px;
        border-radius: 6px;
        padding: 20px 20px;
        display:flex; 
        gap:14px;
        justify-content:space-between;
      ">

      <HeatMap />
      <Select label="Select year" style="max-width:100px; margin-bottom:10px;" :tabindex="-1"
        :options="['2023', '2024']" :default="'2024'" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { HeatMap } from '@/features/profile/heatmap'
import { UserAvatar } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Select } from '@/shared/ui/select'
import { Typography } from '@/shared/ui/typography'
import { ref } from 'vue'

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

@media screen and (max-width: 400px) {
  .user {
    flex-direction: column;
  }
}

.profile {
  &__header {
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
