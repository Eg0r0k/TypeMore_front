<template>
  <div class="controls">
    <Button
      class="controls__btn"
      size="l"
      color="gray"
      :disabled="!canAct"
      @click="session.createRoom()"
    >
      <div class="flex flex-col gap-2 items-center">
        <IconUsers class="size-10" />
        <Typography is-bold>{{ t('servers.create') }}</Typography>
      </div>
    </Button>
    <Button
      class="controls__btn"
      size="l"
      color="gray"
      :disabled="!canAct"
      @click="joinOpen = true"
    >
      <div class="flex flex-col gap-2 items-center">
        <IconCode class="size-10" />
        <Typography is-bold>{{ t('servers.joinByCode') }}</Typography>
        <Typography size="xs">{{ t('servers.join.hint') }}</Typography>
      </div>
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
  import { Typography } from '@/shared/ui/typography'
  import IconCode from '~icons/tabler/code'
  import IconUsers from '~icons/tabler/users'

  /**
   * v1 entry points: create a room or join by code. The public-room-list
   * browser has no protocol support in v1 (the room list is a later server
   * phase), so it is gone along with the old mock server request.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()
  const joinOpen = ref(false)

  // Room commands are only sendable from a connected, not-yet-seated socket.
  const canAct = computed(() => session.connection === 'idle' && !session.room)
</script>

<style lang="scss" scoped>
  .controls {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr;

    &__btn {
      height: 100%;
    }
  }

  @media screen and (width <=475px) {
    .controls {
      grid-template-columns: 1fr;
    }

    .controls__btn {
      width: 100%;
    }
  }
</style>
