<template>
  <div class="serverPage">
    <div class="serverPage__head head">
      <Typography class="serverPage__title" color="primary" size="xxl" tag-name="h1">
        Welcome to <Typography tag-name="span" size="xxl" color="main">Servers</Typography>
      </Typography>
      <div class="serverPage__info">
        <Typography size="s" color="sub">
          Online <Typography tag-name="span" size="m" color="primary">{{ online }}</Typography>
        </Typography>
      </div>
    </div>

    <div class="serverPage__main main">
      <Button size="m" color="main-outline">Create room</Button>
      <Button size="m" color="main-outline">Browse lobbies</Button>
      <Button size="m" color="main-outline">Enter code</Button>
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

const online = ref(3)
const showLobbyList = ref(false)
const lobbies = ref([] as any[])

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
.serverPage {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  &__main {
    display: flex;
    gap: 20px;
  }

  &__info {
    text-align: end;
  }

  &__title {
    margin-bottom: 0;
  }
}
</style>
