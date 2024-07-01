<template>
    <div class="cookie-modal">


            <div v-if="showDefaultView">
                <div class="cookie-modal__header">
                    <Typography size="xl" color="main" class="cookie-modal__title">
                        <Icon width="55" icon="mingcute:cookie-line" />We use Cookie
                    </Typography>

                    <Typography size="s" color="primary">Our site using cookies to help improve user expeance.
                    </Typography>
                </div>

                <div class="cookie-modal__controller">
                    <Button button-label="accept all cookies">Accept all</Button>
                    <Button button-label="Reqject cookies" color="gray">Reqject non-essential</Button>
                    <Button button-label="select cookies" @click="toggleView" color="gray">More options</Button>
                </div>
            </div>
            <div v-else>
                <Typography size="xl" color="primary"> Security</Typography>
                <CheckBox :value="true">
                    <Typography color="primary">Apply metrics cookie</Typography>
                </CheckBox>
                <Typography size="xl" color="primary">Metrics</Typography>
                <CheckBox :value="true">
                    <Typography color="primary">Apply metrics cookie</Typography>
                </CheckBox>
                <Button button-label="accept selected cookies">Accept selected</Button>
            </div>
     
    </div>
</template>

<script lang="ts" setup>
import { Button } from '@/shared/ui/button';
import { Icon } from '@iconify/vue';
import { Typography } from '@/shared/ui/typography';
import { CheckBox } from '@/shared/ui/checkbox';
import { ref } from 'vue';

const showDefaultView = ref(true);

const toggleView = () => {
    showDefaultView.value = !showDefaultView.value;
};
</script>

<style lang="scss" scoped>


.cookie-modal {
    display: flex;
    flex-direction: column;
    padding: 24px;
    width: 450px;
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);
    background: var(--bg-color);
    border-radius: var(--border-radius);

    &__title {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    &__header {
        display: flex;
        flex-direction: column;
        width: 100%;
        margin-bottom: 10px;
        -webkit-user-select: none;
        -moz-user-select: none;
        user-select: none;
    }

    &__controller {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
}
</style>