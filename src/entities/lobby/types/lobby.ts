export enum LobbyRole {
  LobbyOwner = 'lobbyOwner',
  Player = 'player',
  Spectator = 'spectator'
}
export enum LobbyPermission {
  KickPlayer = 'kickPlayer',
  SendMessages = 'sendMessages',
  StartGame = 'startGame',
  ControlPlayers = 'controlPlayers',
  ChangeName = 'changeName',
  ChangeVisibility = 'changeVisibility',
  ChangeConfig = 'changeConfig'
}

export enum LobbyState {
  InGame = 'inGame',
  WaitingForPlayers = 'waitingForPlayers',
  ReadyToStart = 'radyToStart',
  Paused = 'paused',
  Closed = 'closed',
  Finished = 'finished',

  Error = 'error',
  Loading = 'loading'
}
export interface LobbyParticipant {
  id: string
  username: string
  role: LobbyRole
  permissions: LobbyPermission[]
}

export interface LobbySchema {
  readonly id: string
  name: string
  isPublic: boolean
  state: LobbyState
  participants: LobbyParticipant[]
}
