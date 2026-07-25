import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '../types/chat'
import { uuid } from '@shared/lib/helpers/misc'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])

  const addMessage = (username: string, text: string) => {
    messages.value.push({
      id: uuid(),
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
