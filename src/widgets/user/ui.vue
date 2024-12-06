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
    <ul
      v-if="isDropdownOpen"
      id="profile-settings-dropdown"
      class="profile__settings-dropdown"
      role="menu"
      aria-labelledby="profile-settings-button"
    >
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
</template>

<script setup lang="ts">
  import { ProfileStats } from '@/features/profile/stats'
  import { UserAvatar } from '@/shared/ui/avatar'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { ref } from 'vue'
  const isDropdownOpen = ref(false)
  const username = ref('JohnDoe')
  const openDropDown = () => {
    isDropdownOpen.value = !isDropdownOpen.value
  }
</script>

<style lang="scss" scoped>
  @media screen and (width <= 375px) {
    .user {
      flex-direction: column;
    }
  }

  .profile {
    &__settings-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 10;
      min-width: 120px;
      margin: 0;
      padding: 4px 0;
      list-style: none;
      background-color: var(--sub-alt-color);
      border-radius: 4px;
      outline: 2px solid var(--sub-color);
      box-shadow: 0 2px 4px rgb(0 0 0 / 10%);

      li {
        padding: 4px 16px;

        &:hover {
          background-color: var(--bg-color);
        }
      }
    }

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
