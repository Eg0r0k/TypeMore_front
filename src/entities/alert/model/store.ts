import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AlertData } from '../types/alertData'
/**
 * Store for managing alerts.
 * This store keeps a list of alerts and provides functions to add,
 * remove, and access current alerts.
 * @example
 *  const alertStore = useAlertStore()
 *  alertStore.addAlert({ type: 'success', msg: 'Data saved successfully!' })
 *  alertStore.removeAlert(1)
 */

export const useAlertStore = defineStore('alerts', () => {
  const alerts = ref<AlertData[]>([])
  /**
   * Computed property that returns the first 5 alerts.
   * Using for limit of notifications.
   *
   * @returns {AlertData[]} Array of the first 5 alerts
   */
  const queuedAlerts = computed(() => alerts.value.slice(0, 5))
  /**
   * Function to add new alert to the list.
   *
   * @param {Omit<AlertData, 'id'>} alert - An alert object without the 'id' field, which will be added automatically.
   * @example
   * alertStore.addAlert({ type: AlertType.Error, msg: 'Something went wrong' })
   */
  const addAlert = (alert: Omit<AlertData, 'id'>): void => {
    const newAlert: AlertData = {
      id: alerts.value.length > 0 ? alerts.value[alerts.value.length - 1].id + 1 : 0,
      ...alert
    }
    alerts.value.push(newAlert)
  }
  /**
   * Function to remove alert by its id from the list.
   *
   * @param {number} id - The unique ID of the alert to remove.
   * @example
   * alertStore.removeAlert(1)
   */
  const removeAlert = (id: number) => {
    const index = alerts.value.findIndex((alert) => alert.id === id)
    if (index !== -1) {
      alerts.value.splice(index, 1)
    }
  }

  return { addAlert, removeAlert, alerts, queuedAlerts }
})
