<template>
  <div class="server-page">
    <div class="server-page__head head">
      <Typography class="server-page__title" color="primary" size="xxl" tag-name="h1">
        Welcome to
        <Typography tag-name="span" size="xxl" color="main">Servers</Typography>
      </Typography>
      <div class="server-page__info">
        <Typography size="s" color="sub">
          Online
          <Typography tag-name="span" size="m" color="primary">{{ online }}</Typography>
        </Typography>
      </div>
    </div>

    <div class="server-page__main main">
      <Button class="main__btn" size="l" color="gray">
        <div>
          <Icon width="40" icon="fa6-solid:users" />
          <Typography isBold>Create room</Typography>
          <Typography size="xs">Rooms: 0</Typography>
        </div>
      </Button>
      <Button @click="handleServersModal" class="main__btn" size="l" color="gray">
        <div>
          <Icon width="40" icon="mynaui:servers-solid" />
          <Typography isBold>Public rooms</Typography>
          <Typography size="xs">Rooms: 0</Typography>
        </div>
      </Button>
      <Button @click="handleCodeModal" class="main__btn" size="l" color="gray">
        <div>
          <Icon width="40" icon="mingcute:code-fill" />
          <Typography isBold>Enter code</Typography>
          <Typography size="xs">Join using a room code</Typography>
        </div>
      </Button>
    </div>

    <ul v-if="showLobbyList" id="lobbyList">
      <li v-for="lobby in lobbies" :key="lobby.id">
        <Typography color="primary">
          {{ lobby.id }}
        </Typography>
        <Button size="s">Join</Button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Icon } from '@iconify/vue'
  import { useModal } from '@/entities/modal'
  import { ServersModal } from '@/features/modal/servers'
  import { JoinCodeModal } from '@/features/modal/joinCode'

  const online = ref(3)
  const showLobbyList = ref(false)
  const lobbies = ref([] as any[])
  const modal = useModal()

  const handleServersModal = () => {
    modal.open(ServersModal, 'center', 'center')
  }
  const handleCodeModal = () => {
    modal.open(JoinCodeModal, 'center', 'center')
  }

  const browseLobbies = () => {
    showLobbyList.value = !showLobbyList.value
  }

  function setupSSE() {
    const eventSource = new EventSource('http://localhost:3000/api/v1/sse/public')

    eventSource.onopen = () => {
      console.log('SSE connection opened')
    }

    eventSource.onmessage = (event) => {
      console.log('SSE data received:', event.data)
      try {
        const data = JSON.parse(event.data)
        console.log('Parsed data:', data)

        if (data && data.type === 'lobby_created') {
          const lobby = data.lobby

          const exists = lobbies.value.some((lobbyItem) => lobbyItem.id === lobby.id)
          if (!exists) {
            lobbies.value.push(lobby)
            console.log('Added new lobby:', lobby)
          }
        } else {
          lobbies.value.push(data)
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
        console.error('Received raw data:', event.data)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      eventSource.close()
    }
  }

  onMounted(() => {
    setupSSE()
    browseLobbies()
  })
</script>

<style scoped lang="scss">
  .main {
    &__btn {
      height: 100%;
    }
  }

  .server-page {
    &__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    &__main {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 1fr;
    }

    &__info {
      text-align: end;
    }

    &__title {
      margin-bottom: 0;
    }
  }

  @media screen and (width <=475px) {
    .server-page__main {
      grid-template-columns: 1fr;
    }

    .main__btn {
      width: 100%;
    }
  }
</style>
