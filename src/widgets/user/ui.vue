<template>
  <div class="profile__user user">
    <UserAvatar :username="username" />
    <h1 class="user__username">
      <Typography color="primary" size="xl" tag="span">{{ username }}</Typography>
      <Typography color="sub" size="m" tag="span">{{ username }}</Typography>
    </h1>
  </div>
  <ProfileStats />
  <div class="profile__settings-wrapper">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button button-label="•••" size="s" color="gray" aria-haspopup="menu">•••</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @select="onAction('set')">set</DropdownMenuItem>
        <DropdownMenuItem @select="onAction('get')">get</DropdownMenuItem>
        <DropdownMenuItem @select="onAction('copy')">copy</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
  import { ProfileStats } from '@/features/profile/stats'
  import { UserAvatar } from '@/shared/ui/avatar'
  import { Button } from '@/shared/ui/button'
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
  } from '@/shared/ui/dropdown-menu'
  import { Typography } from '@/shared/ui/typography'
  import { ref } from 'vue'
  const username = ref('JohnDoe')
  const onAction = (_action: 'set' | 'get' | 'copy'): void => {
    // TODO: wire profile settings actions
  }
</script>

<style lang="scss" scoped>
  @media screen and (width <= 375px) {
    .user {
      flex-direction: column;
    }
  }

  .profile {
    &__settings-wrapper {
      position: absolute;
      top: 14px;
      right: 14px;
    }
  }

  .user {
    display: flex;
    gap: 32px;
    align-items: center;

    &__username {
      margin: 10px;
    }
  }
</style>
