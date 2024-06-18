<template>
    <div class="alerts-box">
        <Alert :type="alert.type" :duration="alert.duration" :closable="alert.closable" :msg="alert.msg"
            :title="alert.title" v-for="alert in alerts" :key="alert.id" />
    </div>
</template>

<script lang="ts" setup>
import { Alert } from '@/shared/ui/alert'
import { ref, watch } from 'vue';
enum AlertType {
    Error = "error",
    Info = "info",
    Success = "success",
    Warning = "warn",
}
interface AlertData {
    id: number;
    type: AlertType;
    msg: string;
    title?: string;
    duration?: number;
    closable?: boolean;
}
const alerts = ref<AlertData[]>([]);
const nextId = ref(0);

const addAlert = (alert: Omit<AlertData, 'id'>) => {
    console.log(alerts.value)
    alerts.value.push({
        id: nextId.value++,
        ...alert,
    });
};
const removeAlert = (id: number) => {
    alerts.value = alerts.value.filter((alert) => alert.id !== id);
};
watch(
    () => alerts.value,
    (newAlerts) => {
        if (newAlerts.length === 0) {
            nextId.value = 0;
        }
    }
);

defineExpose({
    addAlert,
    removeAlert,
});

</script>

<style lang="scss" scoped>
.alerts-box {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 1rem;
    gap: 8px;
 
}
</style>