<template>
  <div v-if="lobbyStore.lobby" class="players">
    <div class="players__room-name">
      <Typography color="sub" class="players__label">Room name</Typography>
      <div class="players__room-name-content">
        <Typography size="m">{{ lobbyStore.lobby.name }}</Typography>
        <Button
          button-label="change room name"
          v-if="lobbyStore.hasLobbyPermission(LobbyPermission.ChangeName)"
          color="shadow"
          size="s"
        >
          <template #left-icon>
            <Icon icon="mingcute:quill-pen-fill" />
          </template>
        </Button>
      </div>
    </div>
    <div class="players__visibility">
      <Typography color="sub" class="players__label">Visibility</Typography>
      <div class="players__room-visibility-content">
        <Typography>
          {{ lobbyStore.lobby.state === LobbyState.WaitingForPlayers ? 'Private' : 'Public' }}
        </Typography>
        <Button size="s" color="shadow" button-label="change room visibility">
          <template #left-icon>
            <Icon icon="uis:lock-open-alt" />
          </template>
        </Button>
      </div>
    </div>
    <div>
      <Typography color="sub" class="players__label">Users</Typography>
      <div class="players__list">
        <div
          v-for="participant in uniqueParticipants"
          :key="participant.id"
          :class="getUserClass(participant.id)"
        >
          <div class="user__name-and-icons">
            <div class="user__icons">
              <Icon :icon="getRoleIcon(participant.role)" />
            </div>
            <div class="user__name">{{ participant.username }}</div>
            <Button
              @click="handeleControlsModal(participant.username)"
              v-if="lobbyStore.canControlOtherUser(participant.id)"
              color="shadow"
              size="s"
            >
              <template #left-icon>
                <Icon icon="solar:settings-bold" />
              </template>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { useAuthStore } from '@/entities/auth/model/store'
  import { useLobbyStore } from '@/entities/lobby'
  import {
    LobbyParticipant,
    LobbyPermission,
    LobbyRole,
    LobbyState
  } from '@/entities/lobby/types/lobby'
  import { useModal } from '@/entities/modal'
  import { ControlPlayerModal } from '@/features/modal/controlPlayer'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Icon } from '@iconify/vue'
  import clsx from 'clsx'
  const lobbyStore = useLobbyStore()
  const authStore = useAuthStore()
  const modal = useModal()
  const getUserClass = (userId: string) => {
    return clsx('user', { 'user--me': userId === authStore.user?._id })
  }
  const getUniqueUsernames = (participants: LobbyParticipant[]) => {
    const usernameCountMap = new Map<string, number>()
    const uniqueParticipants: LobbyParticipant[] = []

    participants.forEach((participant) => {
      const { username } = participant

      if (usernameCountMap.has(username)) {
        const count = usernameCountMap.get(username)!
        usernameCountMap.set(username, count + 1)
        uniqueParticipants.push({ ...participant, username: `${username}(${count})` })
      } else {
        usernameCountMap.set(username, 1)
        uniqueParticipants.push(participant)
      }
    })

    return uniqueParticipants
  }
  const uniqueParticipants = getUniqueUsernames(lobbyStore.lobby?.participants || [])
  const getRoleIcon = (role: LobbyRole) => {
    switch (role) {
      case LobbyRole.LobbyOwner:
        return 'mdi:crown'
      case LobbyRole.Player:
        return 'mdi:account'
      case LobbyRole.Spectator:
        return 'mdi:eye'
      default:
        return 'mdi:account'
    }
  }

  const handeleControlsModal = (username: string) => {
    modal.open(ControlPlayerModal, 'center', 'center', true, {}, { username })
  }
</script>

<style lang="scss" scoped>
  .user {
    &__name-and-icons {
      display: flex;
      align-items: center;
    }

    &__icons {
      display: flex;
      margin-right: 4px;
    }

    &--me {
      color: var(--main-color);
    }
  }

  .players {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    &__list {
      overflow-y: scroll;
      height: 12rem;
    }

    &__room-name-content,
    &__room-visibility-content {
      display: flex;
      align-items: center;
    }
  }
</style>
