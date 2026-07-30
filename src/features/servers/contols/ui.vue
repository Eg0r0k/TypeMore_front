<template>
  <div class="controls">
    <Button
      size="m"
      color="gray"
      :disabled="!canAct"
      :title="canAct ? undefined : t('servers.lobby.reason.offline')"
      @click="session.createRoom()"
    >
      <IconUsers />
      {{ t('servers.create') }}
    </Button>
    <Button
      size="m"
      color="gray"
      :disabled="!canAct"
      :title="canAct ? undefined : t('servers.lobby.reason.offline')"
      @click="joinOpen = true"
    >
      <IconCode />
      {{ t('servers.joinByCode') }}
    </Button>
    <JoinCodeModal v-model:open="joinOpen" />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useMatchSessionStore } from '@/entities/match'
  import { JoinCodeModal } from '@/features/modal/joinCode'
  import { Button } from '@/shared/ui/button'
  import IconCode from '~icons/tabler/code'
  import IconUsers from '~icons/tabler/users'

  /**
   * v1 entry points: create a room or join by code — as a COMPACT action row,
   * not banner cards. The page's decision lives in the room list below, so the
   * entry points take one line and the list gets the fold. The join hint lives
   * in the join modal, next to the input it explains.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()
  const joinOpen = ref(false)

  // Room commands are only sendable from a connected, not-yet-seated socket.
  const canAct = computed(() => session.connection === 'idle' && !session.room)
</script>

<style lang="scss" scoped>
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
</style>
