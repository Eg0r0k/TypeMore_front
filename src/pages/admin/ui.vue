<template>
  <div class="mt-2 min-w-0 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-12">
    <aside class="min-w-0">
      <Typography tag-name="h1" size="l" color="primary">{{ t('admin.title') }}</Typography>
      <nav
        class="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        :aria-label="t('admin.title')"
      >
        <RouterLink
          v-for="section in sections"
          :key="section.testid"
          :to="section.to"
          class="focus-ring flex shrink-0 items-center gap-2.5 rounded-[6px] px-3 py-2 text-sm transition-tm"
          :class="
            isActive(section)
              ? 'bg-sub-alt text-text'
              : 'text-sub hover:bg-sub-alt/50 hover:text-text'
          "
          :aria-current="isActive(section) ? 'page' : undefined"
          :data-testid="section.testid"
        >
          <component :is="section.icon" class="size-4 shrink-0" aria-hidden="true" />
          {{ t(section.label) }}
        </RouterLink>
      </nav>
    </aside>

    <main class="mt-8 min-w-0 lg:mt-0">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, RouterView, useRoute } from 'vue-router'
  import IconFlag from '~icons/tabler/flag'
  import IconUsers from '~icons/tabler/users'
  import IconKeyboard from '~icons/tabler/keyboard'

  import { usePermissions, type Permission } from '@/entities/auth'
  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The admin shell. Sections are rendered from the CAPABILITIES `/me` serves
   * (backend docs/MODERATION.md) — never from a role: a capability the account
   * lacks is a section that does not exist here, byte-for-byte like the
   * server's 404.
   */
  const { t } = useI18n()
  const { can } = usePermissions()
  const route = useRoute()

  const SECTIONS: readonly {
    permission: Permission
    to: ReturnType<typeof routeLocation.adminReports>
    /** Route names this section claims; the bare /admin root belongs to the inbox. */
    names: readonly string[]
    label: string
    icon: unknown
    testid: string
  }[] = [
    {
      permission: 'reports:read',
      to: routeLocation.adminReports(),
      names: [ROUTE_NAMES.ADMIN, ROUTE_NAMES.ADMIN_REPORTS],
      label: 'admin.nav.reports',
      icon: IconFlag,
      testid: 'admin-nav-reports'
    },
    {
      permission: 'runs:review',
      to: routeLocation.adminRuns(),
      names: [ROUTE_NAMES.ADMIN_RUNS],
      label: 'admin.nav.runs',
      icon: IconKeyboard,
      testid: 'admin-nav-runs'
    },
    {
      permission: 'bans:read',
      to: routeLocation.adminPlayers(),
      names: [ROUTE_NAMES.ADMIN_PLAYERS],
      label: 'admin.nav.players',
      icon: IconUsers,
      testid: 'admin-nav-players'
    }
  ]

  const sections = computed(() => SECTIONS.filter((section) => can(section.permission)))

  const isActive = (section: (typeof SECTIONS)[number]): boolean =>
    typeof route.name === 'string' && section.names.includes(route.name)
</script>
