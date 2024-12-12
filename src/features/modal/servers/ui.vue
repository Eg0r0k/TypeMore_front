<template>
  <div class="server-modal">
    <Typography class="server-modal__title" size="l" tag-name="h2" color="primary">
      Rooms
    </Typography>
    <div class="server-modal__search">
      <SearchBar
        v-model="searchQuery"
        placeholder="Search room..."
        aria-label="Search room by name"
      />
    </div>
    <ul class="server-modal__rooms" aria-live="polite">
      <RoomWidget
        v-for="room in filteredRooms"
        :key="room.id"
        v-bind="room"
        @select-room="selectRoom"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'
  import { RoomWidget } from '@/widgets/room'
  const rooms = ref([
    { id: '1', name: 'Room 1', hasPassword: true },
    { id: '2', name: 'Room 2', hasPassword: false },
    { id: '3', name: 'Room 3', hasPassword: true },
    { id: '4', name: 'Room 4', hasPassword: false },
    { id: '5', name: 'Room 5', hasPassword: true },
    { id: '6', name: 'Room 6', hasPassword: false },
    { id: '7', name: 'Room 7', hasPassword: true },
    { id: '8', name: 'Room 8', hasPassword: false },
    { id: '9', name: 'Room 9', hasPassword: true },
    { id: '10', name: 'Room 10', hasPassword: false },
    { id: '11', name: 'Room 10', hasPassword: false },
    { id: '12', name: 'Room 10', hasPassword: false },
    { id: '13', name: 'Room 10', hasPassword: false },
    { id: '14', name: 'Room 10', hasPassword: false },
    { id: '15', name: 'Room 10', hasPassword: false },
    { id: '16', name: 'Room 10', hasPassword: false },
    { id: '17', name: 'Room 10', hasPassword: false }
  ])

  const searchQuery = ref('')

  const selectRoom = (room: { id: string; name: string }) => {
    console.log(`[Servers] Selected room ${room.id}, name: ${room.name}`)
  }
  const filteredRooms = computed(() => {
    return rooms.value.filter((room) => {
      return room.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    })
  })
</script>

<style lang="scss" scoped>
  .server-modal {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    max-width: 600px;
    padding: 1.5rem;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);

    &__title {
      margin-bottom: 10px;
    }

    &__search {
      margin-bottom: 20px;
    }

    &__rooms {
      display: flex;
      flex: 1;
      margin: 0;
      padding: 0 10px 0 3px;
      overflow-y: auto;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
    }
  }

  @media (width <=768px) {
    .server-modal {
      &__rooms {
        padding-right: 5px;
      }
    }
  }
</style>
