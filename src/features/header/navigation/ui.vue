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
        size="icon-sm"
        color="shadow"
        :aria-label="$t('settings.title')"
        :title="$t('settings.title')"
        @click="dialogs.openSettings()"
      >
        <IconSettings class="size-6" aria-hidden="true" />
      </Button>
      <DropdownMenu v-if="isAuth">
        <DropdownMenuTrigger as-child>
          <Button color="shadow" size="s" class="controls__user" :button-label="displayName">
            <!-- The account's own face, next to its own name — decoration in
                 the accessibility tree, because the name is right there. -->
            <UserAvatar :name="displayName" :src="avatarUrl" class="size-6" />
            {{ displayName }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{{ displayName }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <!-- The way to one's own statistics. A menu item, not a nav icon:
               /profile is about the account, and the account menu is where a
               reader goes looking for it. -->
          <DropdownMenuItem data-testid="header-profile-link" @select="onProfile">
            <IconChartBar class="size-4" aria-hidden="true" />
            {{ t('auth.header.profile') }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="isModerator" data-testid="header-admin-link" @select="onAdmin">
            <IconShield class="size-4" aria-hidden="true" />
            {{ t('admin.title') }}
          </DropdownMenuItem>
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
  import { UserAvatar } from '@/shared/ui/avatar'
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
  import IconSettings from '~icons/tabler/settings'
  import IconChartBar from '~icons/tabler/chart-bar'
  import IconShield from '~icons/tabler/shield'
  import IconUser from '~icons/tabler/user'

  import { computed } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore, useCurrentUser } from '@/entities/auth'
  import { useDialogsStore } from '@/entities/dialogs'
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
  const isModerator = computed(() => (user.value?.permissions ?? []).length > 0)
  /** Absent until the server serves avatars; the initials stand in until then. */
  const avatarUrl = computed(() => user.value?.avatarUrl ?? null)

  const { mutate: logout } = useLogoutMutation()

  const onProfile = (): void => void router.push(routeLocation.profile())
  const onAdmin = (): void => void router.push(routeLocation.admin())
  /** Settings live in App.vue now; the header only asks for them. */
  const dialogs = useDialogsStore()

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
