<template>
  <div class="flex min-w-0 flex-col">
    <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
      <Typography color="primary" size="xxl" tag-name="h1">{{ t('admin.title') }}</Typography>
      <nav
        v-if="sections.length > 1"
        class="flex flex-wrap items-center gap-1.5"
        :aria-label="t('admin.title')"
      >
        <RouterLink
          v-for="section in sections"
          :key="section.testid"
          :to="section.to"
          class="focus-ring rounded-[6px] px-2 py-1 text-sm text-sub transition-tm hover:text-text"
          active-class="bg-sub-alt text-text"
          :data-testid="section.testid"
        >
          {{ t(section.label) }}
        </RouterLink>
      </nav>
    </div>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink, RouterView } from 'vue-router'

  import { usePermissions, type Permission } from '@/entities/auth'
  import { routeLocation } from '@/shared/router'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The admin shell. Sections are rendered from the CAPABILITIES `/me` serves
   * (backend docs/MODERATION.md) — never from a role: a capability the account
   * lacks is a section that does not exist here, byte-for-byte like the
   * server's 404.
   */
  const { t } = useI18n()
  const { can } = usePermissions()

  const SECTIONS: readonly {
    permission: Permission
    to: ReturnType<typeof routeLocation.adminReports>
    label: string
    testid: string
  }[] = [
    {
      permission: 'reports:read',
      to: routeLocation.adminReports(),
      label: 'admin.nav.reports',
      testid: 'admin-nav-reports'
    },
    {
      permission: 'bans:read',
      to: routeLocation.adminPlayers(),
      label: 'admin.nav.players',
      testid: 'admin-nav-players'
    }
  ]

  const sections = computed(() => SECTIONS.filter((section) => can(section.permission)))
</script>
