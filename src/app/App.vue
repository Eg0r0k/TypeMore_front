<script setup lang="ts">
import { useScreenStore } from '@/entities/screen/model';
import { onMounted, onUnmounted } from 'vue';
import { useFps } from '@vueuse/core'
const screenStore = useScreenStore()
const { setPlatform } = screenStore
const onResize = () => setPlatform(window.innerWidth)
onMounted(() => {
    setPlatform(window.innerWidth);
    window.addEventListener('resize', onResize)
})
onUnmounted(() => {
    window.removeEventListener('resize', onResize)
})


const fps = useFps()
</script>

<template>
    <div class="fps">
        FPS: {{ fps }}
    </div>
    <RouterView />
</template>

<style lang="scss">
.fps {
    position: absolute;
    top: 20px;
    left: 20px;
    color: var(--main-color)
}
</style>
