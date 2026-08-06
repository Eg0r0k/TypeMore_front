<template>
  <div class="settings-section">
    <!-- Anonymous: these switches live on the account, so there is nothing to
         flip without one. A hint, not a wall — the rest of the dialog is
         local preferences and works signed out. -->
    <div v-if="!authStore.isAuth" class="py-3" data-testid="settings-account-signin">
      <Typography size="s" color="sub">{{ t('settings.account.signin') }}</Typography>
    </div>

    <template v-else>
      <SettingRow id="displayName">
        <form class="flex w-full items-center gap-2" @submit.prevent="onRename">
          <Input
            v-model="nameDraft"
            :disabled="renameLocked || renaming"
            :aria-label="t('settings.displayName.label')"
            data-testid="settings-display-name"
          />
          <Button
            type="submit"
            color="main"
            size="s"
            :disabled="renameLocked || renaming || !renameable"
            data-testid="settings-display-name-save"
          >
            {{ t('settings.displayName.save') }}
          </Button>
        </form>
        <template #note>
          <Typography
            v-if="renameLocked"
            size="xs"
            color="sub"
            tag-name="p"
            data-testid="settings-display-name-cooldown"
          >
            {{ t('settings.displayName.cooldown', { date: nextRenameDate }) }}
          </Typography>
          <Typography
            v-else-if="renameError"
            size="xs"
            color="error"
            tag-name="p"
            data-testid="settings-display-name-error"
          >
            {{ t(renameError) }}
          </Typography>
        </template>
      </SettingRow>

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
  import { computed, ref, watch } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'

  import {
    isApiError,
    meQueryOptions,
    useChangeDisplayNameMutation,
    useUpdateSettingsMutation,
    type SettingsInput
  } from '@shared/api'
  import { gatedBy } from '@shared/lib/helpers/gated-query'
  import { useAuthStore } from '@/entities/auth'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { Button } from '@/shared/ui/button'
  import { Input } from '@/shared/ui/input'
  import { toast } from '@/shared/ui/sonner'
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
  const { t, locale } = useI18n()
  const authStore = useAuthStore()

  const me = useQuery(computed(() => gatedBy(meQueryOptions(), authStore.isAuth)))
  const mutation = useUpdateSettingsMutation()

  const profilePublic = computed(() => me.data.value?.profilePublic ?? true)
  const keyboardPublic = computed(() => me.data.value?.keyboardPublic ?? false)
  const saving = computed(() => mutation.isPending.value)
  const failed = computed(() => mutation.isError.value)

  const save = (input: SettingsInput): void => void mutation.mutate(input)

  /** Once per 30 days — the client-side twin of the server's cooldown predicate. */
  const RENAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

  const nameDraft = ref('')
  watch(
    () => me.data.value?.displayName,
    (name) => {
      if (name !== undefined) nameDraft.value = name
    },
    { immediate: true }
  )

  const nextRenameAt = computed(() => {
    const changed = me.data.value?.displayNameChangedAt
    if (!changed) return null
    const at = Date.parse(changed) + RENAME_COOLDOWN_MS
    return at > Date.now() ? at : null
  })
  const renameLocked = computed(() => nextRenameAt.value !== null)
  const nextRenameDate = computed(() =>
    nextRenameAt.value === null
      ? ''
      : formatShortDate(new Date(nextRenameAt.value).toISOString(), locale.value)
  )
  const renameable = computed(() => {
    const draft = nameDraft.value.trim()
    return draft !== '' && draft !== (me.data.value?.displayName ?? '')
  })

  const rename = useChangeDisplayNameMutation()
  const renaming = computed(() => rename.isPending.value)
  const renameError = ref<string | null>(null)

  const RENAME_ERROR_KEYS: Record<string, string> = {
    name_taken: 'settings.displayName.errors.taken',
    display_name_cooldown: 'settings.displayName.errors.cooldown',
    bad_request: 'settings.displayName.errors.invalid'
  }

  const onRename = (): void => {
    if (!renameable.value || renameLocked.value) return
    renameError.value = null
    rename.mutate(
      { displayName: nameDraft.value.trim() },
      {
        onSuccess: () => toast(t('settings.displayName.renamed')),
        onError: (error) => {
          renameError.value =
            (isApiError(error) && RENAME_ERROR_KEYS[error.code]) ||
            'settings.displayName.errors.generic'
        }
      }
    )
  }
</script>

<style lang="scss" scoped>
  .settings-section {
    display: flex;
    flex-direction: column;
  }
</style>
