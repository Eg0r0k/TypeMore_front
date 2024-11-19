import { useAlertStore } from '@/entities/alert'
import { AlertData, AlertType } from '@/entities/alert/types/alertData'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

describe('useAlertStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with an empty alerts array', () => {
    const alertStore = useAlertStore()
    expect(alertStore.alerts).toEqual([])
    expect(alertStore.queuedAlerts).toEqual([])
  })

  it('should add an alert with auto-incrementing ID', () => {
    const alertStore = useAlertStore()
    const newAlert: Omit<AlertData, 'id'> = {
      type: AlertType.Success,
      msg: 'Test message'
    }

    alertStore.addAlert(newAlert)
    expect(alertStore.alerts).toHaveLength(1)
    expect(alertStore.alerts[0]).toEqual({ id: 0, ...newAlert })
    expect(alertStore.queuedAlerts).toHaveLength(1)
    expect(alertStore.queuedAlerts[0]).toEqual({ id: 0, ...newAlert })

    alertStore.addAlert({ type: AlertType.Error, msg: 'Another message' })
    expect(alertStore.alerts).toHaveLength(2)
    expect(alertStore.alerts[1]).toEqual({ id: 1, type: AlertType.Error, msg: 'Another message' })
    expect(alertStore.queuedAlerts).toHaveLength(2)
    expect(alertStore.queuedAlerts[1]).toEqual({
      id: 1,
      type: AlertType.Error,
      msg: 'Another message'
    })
  })

  it('should remove an alert by ID', () => {
    const alertStore = useAlertStore()
    alertStore.addAlert({ type: AlertType.Info, msg: 'Test message 1' })
    alertStore.addAlert({ type: AlertType.Warning, msg: 'Test message 2' })

    alertStore.removeAlert(0)

    expect(alertStore.alerts).toHaveLength(1)
    expect(alertStore.alerts[0]).toEqual({ id: 1, type: AlertType.Warning, msg: 'Test message 2' })
    expect(alertStore.queuedAlerts).toHaveLength(1)
    expect(alertStore.queuedAlerts[0]).toEqual({
      id: 1,
      type: AlertType.Warning,
      msg: 'Test message 2'
    })
  })

  it('should handle removing a non-existent alert', () => {
    const alertStore = useAlertStore()
    alertStore.addAlert({ type: AlertType.Info, msg: 'Test message' })

    alertStore.removeAlert(999)

    expect(alertStore.alerts).toHaveLength(1)
    expect(alertStore.queuedAlerts).toHaveLength(1)
  })

  it('should limit queued alerts to 5', () => {
    const alertStore = useAlertStore()
    for (let i = 0; i < 7; i++) {
      alertStore.addAlert({ type: AlertType.Info, msg: `Test message ${i}` })
    }

    expect(alertStore.alerts).toHaveLength(7)
    expect(alertStore.queuedAlerts).toHaveLength(5)
  })
})
