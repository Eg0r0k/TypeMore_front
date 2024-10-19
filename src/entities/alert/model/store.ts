import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AlertData } from './types/alertData'

export const useAlertStore = defineStore('alerts', () => {
  const alerts = ref<AlertData[]>([])
  const nextId = ref(0)
  const queuedAlerts = computed(() => alerts.value.slice(0, 5))
  const addAlert = (alert: Omit<AlertData, 'id'>) => {
    alerts.value.push({
      id: nextId.value++,
      ...alert
    })
  }
  const removeAlert = (id: number) => {
    alerts.value = alerts.value.filter((alert) => alert.id !== id)
  }

  return { addAlert, removeAlert, alerts, queuedAlerts }
})
