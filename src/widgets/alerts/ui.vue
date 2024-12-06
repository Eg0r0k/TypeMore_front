<template>
  <div class="alerts-box">
    <TransitionGroup name="list">
      <Alert
        v-for="alert in alertStore.queuedAlerts"
        :key="alert.id"
        :type="alert.type"
        :duration="alert.duration"
        :closable="alert.closable"
        :msg="alert.msg"
        :title="alert.title"
        @close="alertStore.removeAlert(alert.id)"
      />
    </TransitionGroup>
  </div>
</template>

<script lang="ts" setup>
  import { useAlertStore } from '@/entities/alert/model/store'
  import { Alert } from '@/shared/ui/alert'

  const alertStore = useAlertStore()
</script>
<style lang="scss" scoped>
  .alerts-box {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: var(--alert-z);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    padding: 8px;
    pointer-events: none;
  }

  .list-enter-active,
  .list-leave-active {
    transition: all 0.5s ease;
  }

  .list-leave-to {
    opacity: 0;
    transform: translateY(-100%);
  }

  .list-enter-from {
    opacity: 0;
    transform: translateX(30px);
  }
</style>
