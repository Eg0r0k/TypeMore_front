type ChatMessageType = 'regular' | 'system'

export interface ChatMessage {
  id: string
  username: string
  text: string
  timestamp: Date
  type: ChatMessageType
}
