<template>
  <div class="settings-section">
    <!-- Anonymous: these switches live on the account, so there is nothing to
         flip without one. A hint, not a wall — the rest of the dialog is
         local preferences and works signed out. -->
    <div v-if="!authStore.isAuth" class="py-3" data-testid="settings-account-signin">
      <Typography size="s" color="sub">{{ t('settings.account.signin') }}</Typography>
    </div>

    <template v-else>
      <SettingRow id="profilePublic">
        <Switch
          :model-value="profilePublic"
          :disabled="saving"
          :aria-label="t('settings.profilePublic.label')"
          data-testid="settings-profile-public"
          @update:model-value="(value) => save({ profilePublic: value })"
        />
      </SettingRow>

      <SettingRow id="keyboardPublic">
        <!-- Disabled while the profile is closed: the general switch hides the
             portrait regardless, so an enabled toggle here would promise a
             visibility it cannot deliver. The note says exactly that. -->
        <Switch
          :model-value="keyboardPublic"
          :disabled="saving || !profilePublic"
          :aria-label="t('settings.keyboardPublic.label')"
          data-testid="settings-keyboard-public"
          @update:model-value="(value) => save({ keyboardPublic: value })"
        />
        <template #note>
          <Typography
            v-if="!profilePublic"
            size="xs"
            color="sub"
            tag-name="p"
            data-testid="settings-keyboard-public-note"
          >
            {{ t('settings.keyboardPublic.closedNote') }}
          </Typography>
        </template>
      </SettingRow>

      <Typography
        v-if="failed"
        size="xs"
        color="error"
        tag-name="p"
        class="py-2"
        data-testid="settings-account-error"
      >
        {{ t('settings.account.error') }}
      </Typography>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'

  import {
    meQueryOptions,
    useUpdateSettingsMutation,
    type SettingsInput
  } from '@shared/api'
  import { useAuthStore } from '@/entities/auth'
  import { Switch } from '@/shared/ui/switch'
  import { Typography } from '@/shared/ui/typography'
  import SettingRow from './SettingRow.vue'

  /**
   * Account privacy — the two switches that live on the SERVER
   * (PATCH /me/settings; backend docs/PROFILE.md, "Public profiles"):
   *
   *   - profilePublic: whether /u/{name} answers strangers at all. Off, the
   *     page still exists and shows nick + "profile closed"; the boards are
   *     NOT affected — a ranked run stays ranked and watchable.
   *   - keyboardPublic: the keyboard portrait's own opt-in, off by default —
   *     per-key timings profile a person's motor behaviour, so only their
   *     owner may publish them. Disabled (with the why) while the profile is
   *     closed, since the general switch hides the portrait regardless.
   *
   * State reads from the `me` query; a PATCH answers with the fresh user view,
   * which the mutation writes straight into that cache — the switch settles on
   * the server's answer, not on optimism.
   */
  const { t } = useI18n()
  const authStore = useAuthStore()

  /** Options + a gate, shaped the way /profile gates its queries. */
  const gatedBy = <T extends object>(options: T, on: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled: on
  })
  const me = useQuery(computed(() => gatedBy(meQueryOptions(), authStore.isAuth)))
  const mutation = useUpdateSettingsMutation()

  const profilePublic = computed(() => me.data.value?.profilePublic ?? true)
  const keyboardPublic = computed(() => me.data.value?.keyboardPublic ?? false)
  const saving = computed(() => mutation.isPending.value)
  const failed = computed(() => mutation.isError.value)

  const save = (input: SettingsInput): void => void mutation.mutate(input)
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
