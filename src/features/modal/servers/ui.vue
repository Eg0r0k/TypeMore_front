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
      <li
        v-for="room in filteredRooms"
        :key="room.id"
        class="room"
        role="button"
        tabindex="0"
        @click="selectRoom(room)"
        @keydown.enter="selectRoom(room)"
        @keydown.space="selectRoom(room)"
        :aria-label="`Select room ${room.name}`"
      >
        <div class="name">
          <div class="title">name</div>
          <div class="value">{{ room.name }}</div>
        </div>
        <div class="name">
          <div class="title">Name</div>
          <div class="value">{{ room.name }}</div>
        </div>
        <div class="players">
          <div class="title">Players</div>
          <div class="value">1</div>
        </div>
        <div class="state">
          <div class="title">State</div>
          <div class="value">Lobby</div>
        </div>
        <div class="config">
          <div class="title">Config</div>
          <div class="value">Time 30 English</div>
        </div>
        <div class="chevron" aria-hidden="true">></div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'
  //TODO: Make RoomWiget component
  const rooms = ref([
    { id: 1, name: 'Room 1', hasPassword: true },
    { id: 2, name: 'Room 2', hasPassword: false },
    { id: 3, name: 'Room 3', hasPassword: true },
    { id: 4, name: 'Room 4', hasPassword: false },
    { id: 5, name: 'Room 5', hasPassword: true },
    { id: 6, name: 'Room 6', hasPassword: false },
    { id: 7, name: 'Room 7', hasPassword: true },
    { id: 8, name: 'Room 8', hasPassword: false },
    { id: 9, name: 'Room 9', hasPassword: true },
    { id: 10, name: 'Room 10', hasPassword: false },
    { id: 11, name: 'Room 10', hasPassword: false },
    { id: 12, name: 'Room 10', hasPassword: false },
    { id: 13, name: 'Room 10', hasPassword: false },
    { id: 14, name: 'Room 10', hasPassword: false },
    { id: 15, name: 'Room 10', hasPassword: false },
    { id: 16, name: 'Room 10', hasPassword: false },
    { id: 17, name: 'Room 10', hasPassword: false }
  ])

  const searchQuery = ref('')

  const selectRoom = (room: { id: number; name: string }) => {
    console.log(`[Servers] Selected room ${room.id}, name: ${room.name}`)
  }
  const filteredRooms = computed(() => {
    return rooms.value.filter((room) => {
      const matchesSearch = room.name.toLowerCase().includes(searchQuery.value.toLowerCase())

      return matchesSearch
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

      .room {
        display: grid;
        grid-template-columns: 1fr 1fr 3fr 0fr;
        grid-auto-rows: auto;
        width: 100%;
        height: min-content;
        padding: 1rem;
        border: 2px solid var(--sub-alt-color);
        gap: 0.5rem;
        transition: 0.25s;
        box-sizing: border-box;
        user-select: none;
        cursor: pointer;
        grid-template-areas:
          'name name name chevron'
          'state players config chevron';
        border-radius: var(--border-radius);

        &:hover {
          background-color: var(--sub-alt-color);
        }

        &:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 1.5px var(--bg-color),
            0 0 0 3px var(--text-color);
        }

        .name {
          grid-area: name;
        }

        .players {
          grid-area: players;
        }

        .state {
          grid-area: state;
        }

        .config {
          grid-area: config;
        }

        .chevron {
          grid-area: chevron;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
        }

        .title {
          font-size: 12px;
          color: var(--sub-color);
        }

        .value {
          font-size: 14px;
          color: var(--text-color);
        }
      }
    }
  }

  @media (width <= 768px) {
    .server-modal {
      &__rooms {
        padding-right: 5px;
      }
    }
  }
</style>
