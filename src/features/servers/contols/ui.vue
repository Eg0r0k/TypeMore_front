<template>
  <div class="controls">
    <Button
      :isLoading="loading"
      @click="handleCreateRoom"
      class="controls__btn"
      size="l"
      color="gray"
    >
      <div>
        <Icon width="40" icon="fa6-solid:users" />
        <Typography isBold>Create room</Typography>
        <Typography size="xs">Rooms: 0</Typography>
      </div>
    </Button>
    <Button @click="handleServersModal" class="controls__btn" size="l" color="gray">
      <div>
        <Icon width="40" icon="mynaui:servers-solid" />
        <Typography isBold>Public rooms</Typography>
        <Typography size="xs">Rooms: 0</Typography>
      </div>
    </Button>
    <Button @click="handleCodeModal" class="controls__btn" size="l" color="gray">
      <div>
        <Icon width="40" icon="mingcute:code-fill" />
        <Typography isBold>Enter code</Typography>
        <Typography size="xs">Join using a room code</Typography>
      </div>
    </Button>
  </div>
</template>

<script lang="ts" setup>
  import { useModal } from '@/entities/modal'
  import { JoinCodeModal } from '@/features/modal/joinCode'
  import { ServersModal } from '@/features/modal/servers'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Icon } from '@iconify/vue'
  import { ref } from 'vue'
  const loading = ref(false)
  const emit = defineEmits<{ (e: 'open-room'): void }>()
  const modal = useModal()
  const handleServersModal = () => {
    modal.open(ServersModal, 'center', 'center')
  }
  const handleCodeModal = () => {
    modal.open(JoinCodeModal, 'center', 'center')
  }
  const mockServerRequest = (): Promise<{ success: boolean }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const isSuccess = Math.random() > 0.5
        if (isSuccess) {
          resolve({ success: true })
        } else {
          reject(new Error('Failed to join room'))
        }
      }, 1000)
    })
  }

  const handleCreateRoom = async () => {
    try {
      loading.value = true
      const response = await mockServerRequest()
      if (response.success) {
        emit('open-room')
      }
    } catch (e) {
      console.error('Failed to join room:', e)
      //
    } finally {
      loading.value = false
    }
  }
</script>

<style lang="scss" scoped>
  .controls {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(3, 1fr);
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
