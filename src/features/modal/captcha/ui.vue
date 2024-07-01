<template>
    <div class="captcha-modal">
        <RecaptchaV2 @widget-id="handleWidgetId" @error-callback="handleErrorCalback"
            @expired-callback="handleExpiredCallback" @load-callback="handleLoadCallback" />
    </div>
</template>

<script lang="ts" setup>
import { RecaptchaV2 } from 'vue3-recaptcha-v2';
const handleWidgetId = (widgetId: number) => {
    console.log('Widget ID: ', widgetId)
}
const handleErrorCalback = () => {
    console.log('Error callback')
}
const handleExpiredCallback = () => {
    console.log('Expired callback')
}
const handleLoadCallback = (response: unknown) => {
    console.log('Load callback', response)
}
</script>

<style lang="scss" scoped>
.captcha-modal {
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);
    background: var(--bg-color);
    border-radius: var(--border-radius);
    padding: 24px;
}
</style>