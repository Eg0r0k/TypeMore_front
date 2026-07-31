<template>
  <aside class="panel" :aria-label="t('servers.panel.label')">
    <div class="panel__action">
      <Button
        class="w-full"
        size="m"
        :disabled="!canAct"
        :title="canAct ? undefined : t('servers.lobby.reason.offline')"
        @click="session.createRoom()"
      >
        <IconPlus class="size-5" />
        {{ t('servers.create') }}
      </Button>
      <Typography size="xs" color="sub">{{ t('servers.panel.createHint') }}</Typography>
    </div>

    <div class="panel__action">
      <Button
        class="w-full"
        size="m"
        color="main-outline"
        :disabled="!canAct"
        :title="canAct ? undefined : t('servers.lobby.reason.offline')"
        @click="joinOpen = true"
      >
        <IconHash class="size-5" />
        {{ t('servers.joinByCode') }}
      </Button>
      <Typography size="xs" color="sub">{{ t('servers.panel.joinHint') }}</Typography>
    </div>

    <JoinCodeModal v-model:open="joinOpen" />
  </aside>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useMatchSessionStore } from '@/entities/match'
  import { JoinCodeModal } from '@/features/modal/joinCode'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import IconHash from '~icons/tabler/hash'
  import IconPlus from '~icons/tabler/plus'

  /**
   * v1 entry points as the page's side panel: create (the primary action, in
   * the accent colour) over join-by-code, each with a one-line hint. The list
   * keeps the leading column — the panel answers "how do I start", the list
   * answers "where can I go". The full join hint still lives in the join
   * modal, next to the input it explains.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()
  const joinOpen = ref(false)

  // Room commands are only sendable from a connected, not-yet-seated socket.
  const canAct = computed(() => session.connection === 'idle' && !session.room)
</script>

<style lang="scss" scoped>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__action {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  }
</style>
