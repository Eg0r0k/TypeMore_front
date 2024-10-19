import { useWebSocket } from '@vueuse/core'

export function useLobbyWebSocket(lobbyID: string) {
  const { send, status, data, open, close } = useWebSocket(
    //!change to env
    `ws://localhost:8080/ws/lobby/${lobbyID}`,
    {
      onConnected() {
        console.log('WebSocket connected')
      },
      onDisconnected() {
        console.log('WebSocket disconnected')
      },
      onError(err) {
        console.error('WebSocket error:', err)
      },
      autoReconnect: {
        retries: 3,
        delay: 1000,
        onFailed() {
          alert('Failed to connect after 3 retries')
        }
      }
    }
  )

  return { send, status, data, open, close }
}
