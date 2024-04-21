<template>

    <Transition>
        <div class="popUp" v-if="isPopUpOpen" @scroll.prevent @wheel.prevent @touchmove.prevent>
            <div class="popUp__wrapper" ref="popUpRef">
                <Button @click="closePopUp">button</Button>
            </div>
        </div>
    </Transition>
</template>

<script setup lang="ts">
//TODO Сделать передачу любых компонентов в пропс
import { Button } from '@/shared/ui/button';
import { Typography } from '@/shared/ui/typography';
import { DefineComponent, ref } from 'vue';
import { onClickOutside } from '@vueuse/core'

const popUpRef = ref(null)
const isPopUpOpen = ref<Boolean>(true);
onClickOutside(
    popUpRef, (e): void => {
        closePopUp()
    }
)
const closePopUp = (): void => {
    isPopUpOpen.value = false
}
const openPopUp = (): void => {

}


</script>

<style scoped lang="scss">
.v-enter-active,
.v-leave-active {
    transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}

.popUp {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(var(--sub-color), 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(5px);

    &__wrapper {
        background-color: var(--sub-alt-color);
        display: flex;
        padding: 32px;
        border-radius: var(--border-radius);
    }
}
</style>