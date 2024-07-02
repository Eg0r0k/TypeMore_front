<template>
    <div class="captcha-modal">
        <RecaptchaV2 @widget-id="handleWidgetId" @error-callback="handleErrorCallback"
            @expired-callback="handleExpiredCallback" @load-callback="handleLoadCallback" />
    </div>
</template>

<script setup lang="ts">
import { useModal } from '@/entities/modal/model/store';
import { useAlertStore } from '@/entities/alert/model';
import { AlertType } from '@/entities/alert/model/types/alertData';
import { RecaptchaV2 } from 'vue3-recaptcha-v2';

const modalStore = useModal();
const alertStore = useAlertStore();

const handleWidgetId = (widgetId: number) => {
    console.log('Widget ID: ', widgetId);
};

const handleLoadCallback = (response: unknown) => {
    console.log('Captcha Verified', response);
    if (typeof response === 'string') {
        modalStore.handlers.onVerified?.(response);
    } else {
        console.error('Unexpected response type from reCAPTCHA');
        alertStore.addAlert({
            type: AlertType.Error,
            title: "Error",
            msg: "An unexpected error occurred. Please try again.",
            duration: 3000
        });
    }
};

const handleErrorCallback = () => {
    console.log('Error callback');
    alertStore.addAlert({
        type: AlertType.Error,
        title: "Error",
        msg: "CAPTCHA verification failed. Please try again.",
        duration: 3000
    });
    modalStore.handlers.onError?.();
};

const handleExpiredCallback = () => {
    console.log('Expired callback');
    alertStore.addAlert({
        type: AlertType.Error,
        title: "Error",
        msg: "CAPTCHA expired. Please try again.",
        duration: 3000
    });
    modalStore.handlers.onExpired?.();
};
</script>

<style lang="scss" scoped>
.captcha-modal {
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);
    background: var(--bg-color);
    border-radius: var(--border-radius);
    padding: 24px;
}
</style>