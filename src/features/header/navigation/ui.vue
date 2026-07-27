<template>
  <nav class="navigation header-navigation" role="navigation" aria-label="header navigation">
    <ul class="flex gap-2 ml-2" role="list">
      <li v-for="link in props.links" :key="link.link" role="listitem">
        <Button size="icon-sm" color="shadow" :button-label="link.label">
          <Link :to="link.link" class="list__link" :title="link.label">
            <component :is="link.icon" class="size-6" aria-hidden="true" />
          </Link>
        </Button>
      </li>
    </ul>
    <div class="navigation__controls controls">
      <Button
        tabindex="0"
        class="controls__alert"
        size="icon-sm"
        color="shadow"
        button-label="Open alerts"
      >
        <IconBell class="size-6" />
      </Button>

      <DropdownMenu v-if="isAuth">
        <DropdownMenuTrigger as-child>
          <Button color="shadow" size="s" class="controls__user" :button-label="displayName">
            <IconUser class="size-6" aria-hidden="true" />
            {{ displayName }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{{ displayName }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="onLogout">{{ t('auth.header.logout') }}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button v-else as-child color="shadow" size="icon-sm" :button-label="t('auth.header.login')">
        <Link :to="routeLocation.login()" class="controls__user" :title="t('auth.header.login')">
          <IconUser class="size-6" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  </nav>
</template>

<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
  import { Link } from '@/shared/ui/link'
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem
  } from '@/shared/ui/dropdown-menu'
  import type { HeaderLink } from './types/links'
  import IconBell from '~icons/tabler/bell'
  import IconUser from '~icons/tabler/user'

  import { computed, ref } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore, useCurrentUser } from '@/entities/auth'
  import { useLogoutMutation } from '@shared/api'
  import { routeLocation } from '@/shared/router'

  interface Props {
    links: readonly HeaderLink[]
  }

  const props = defineProps<Props>()

  const { t } = useI18n()
  const router = useRouter()

  const { isAuth } = storeToRefs(useAuthStore())
  const { data: user } = useCurrentUser()
  const displayName = computed(() => user.value?.displayName ?? '')

  const { mutate: logout } = useLogoutMutation()

  const onLogout = (): void => {
    logout(undefined, {
      onSuccess: () => {
        void router.push(routeLocation.home())
      }
    })
  }
</script>

<style lang="scss" scoped>
  .list {
    &__link {
      display: flex;
      padding: 4px;
    }
  }

  .controls {
    &__user {
      padding: 4px 8px;
    }
  }

  .navigation {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    &__controls {
      display: flex;
      align-items: center;
    }

    &__list {
      display: flex;
      gap: 2px;
    }
  }

  .slide-fade-enter-active {
    transition: all 0.2s ease-out;
  }

  .slide-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-fade-enter-from {
    opacity: 0;
    transform: translateX(100%);
  }

  .slide-fade-leave-to {
    opacity: 0;
    transform: translateX(100%);
  }

  @media screen and (width <=375px) {
    .navigation__controls .iconify,
    .list__link .iconify {
      width: 20px;
      height: 20px;
    }
  }
</style>
