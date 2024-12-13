import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ChatMessage } from '../types/chat'
import { v4 as uuidv4 } from 'uuid'
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])

  const addMessage = (username: string, text: string) => {
    messages.value.push({
      id: uuidv4(),
      username,
      text,
      timestamp: new Date(),
      type: 'regular'
    })
  }
  const clearMessages = () => {
    messages.value = []
  }

  return { addMessage, clearMessages, messages }
})
