<template>
    <Transition>
        <div class="modal" v-if="isOpen" @click.stop="modalStore.close()" 
            :class="{ 'align-start': isCommandLine, 'align-center': !isCommandLine }" tabindex="0">
            <component @click.stop :is="view" v-model="model"></component>
            <button v-for="action in actions" :key="action.label" class="btn" @click="action.callback(model)">
                {{ action.label }}
            </button>
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { useModal } from '@/entities/modal/store';
import { storeToRefs } from 'pinia';
import { reactive, onMounted, onUnmounted } from 'vue';

const model = reactive({});
const modalStore = useModal();
const { isOpen, isCommandLine, view, actions } = storeToRefs(modalStore);

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        modalStore.close();
    }
};

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<style lang="scss" scoped>
.modal {
    padding: 60px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    top: 0;
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: auto;
}

.align-start {
    align-items: start;
}

.align-center {
    align-items: center;
}
</style>
