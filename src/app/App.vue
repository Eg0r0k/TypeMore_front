<script setup lang="ts">
import { useScreenStore } from '@/entities/screen/model'
import { onMounted, onUnmounted, watch, ref, computed } from 'vue'
import { useFps } from '@vueuse/core'
import { PopUp } from '@/features/popup'
import { Header } from '@/widgets/header'
import { Footer } from '@/widgets/footer'
import { Container } from '@/shared/ui/container'
import { useConfigStore } from '@/entities/config/store'
const screenStore = useScreenStore()
const { setPlatform } = screenStore
const onResize = () => setPlatform(window.innerWidth)
onMounted(() => {
    setPlatform(window.innerWidth)
    window.addEventListener('resize', onResize)
})
onUnmounted(() => {
    window.removeEventListener('resize', onResize)
})

const fps = useFps()
const minFps = ref(0)
const maxFps = ref(0)
const avgFps = computed(() => Math.round(((minFps.value + fps.value + maxFps.value) / 3) * 10) / 10)

watch(fps, (value: number) => {
    minFps.value = Math.min(minFps.value || value, value)
    maxFps.value = Math.max(maxFps.value, value)
})

const configStore = useConfigStore();


</script>

<template>
    <div class="fps" v-if="configStore.config.showFps">
        <p>FPS: {{ fps }}</p>
        <p>AVG: {{ avgFps }}</p>
        <p>MAX: {{ maxFps }}</p>
        <p>MIN: {{ minFps }}</p>

    </div>
    <div class="wrapper">
        <Header />

        <main>
            <router-view v-slot="{ Component, route }">
                <transition name="fade" mode="out-in">
                    <component :is="Component" :key="route.path" />
                </transition>
            </router-view>
        </main>
        <Footer />
    </div>

</template>

<style scoped lang="scss">
.fps {
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 1000;
}

.fade-enter-active,
.fade-leave-active {
    transition: all 0.125s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.wrapper {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    min-height: 100vh;
    max-width: 1532px;
    margin: 0 auto;
    padding: 28px 16px;
    box-sizing: border-box;
}

.fps {
    position: absolute;
    pointer-events: none;
    top: 20px;
    left: 20px;
    color: var(--main-color);
}
</style>
