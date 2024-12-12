import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LobbyPermission, LobbyRole, LobbySchema, LobbyState } from '../types/lobby'
import { useAuthStore } from '@/entities/auth/model/store'

export const useLobbyStore = defineStore('lobby', () => {
  const lobby = ref<LobbySchema | null>(null)

  const isRoomManagementOpen = ref(false)
  const authStore = useAuthStore()
  const currentUser = computed(() => authStore.user)

  const createLobby = () => {
    isRoomManagementOpen.value = true
  }
  const leftLobby = () => {
    isRoomManagementOpen.value = false
  }

  lobby.value = {
    id: 'da23sd-fasdsol7-dasbas-01fgdfs',
    name: 'Guest room',
    state: LobbyState.WaitingForPlayers,
    isPublic: true,
    participants: [
      {
        id: 'user1',
        username: 'Eg0rk',
        role: LobbyRole.LobbyOwner,
        permissions: [
          LobbyPermission.KickPlayer,
          LobbyPermission.StartGame,
          LobbyPermission.ChangeConfig,
          LobbyPermission.ChangeVisibility,
          LobbyPermission.ControlPlayers,
          LobbyPermission.ChangeName
        ]
      },
      {
        id: 'user2',
        username: 'Eg0rk',
        role: LobbyRole.Player,
        permissions: []
      },
      {
        id: 'user3',
        username: 'User3',
        role: LobbyRole.Spectator,
        permissions: []
      },
      {
        id: 'user3',
        username: 'User3',
        role: LobbyRole.Spectator,
        permissions: []
      }
    ]
  }
  const canControlOtherUser = (userId: string) => {
    if (!currentUser.value || !lobby.value) return false
    return hasLobbyPermission(LobbyPermission.ControlPlayers) && userId !== currentUser.value._id
  }

  const updateParticipantsRole = (
    userId: string,
    role: LobbyRole,
    permissions: LobbyPermission[]
  ) => {
    if (!lobby.value) return
    const participant = lobby.value.participants.find((p) => p.id === userId)
    if (participant) {
      participant.role = role
      participant.permissions = permissions
    }
  }
  const hasLobbyPermission = (requiredPermission: LobbyPermission): boolean => {
    if (!currentUser.value || !lobby.value) return false

    const participant = lobby.value.participants.find((p) => p.id === currentUser.value?._id)

    return participant?.permissions.includes(requiredPermission) || false
  }

  return {
    lobby,
    canControlOtherUser,
    hasLobbyPermission,
    updateParticipantsRole,
    createLobby,
    leftLobby,
    isRoomManagementOpen
  }
})
