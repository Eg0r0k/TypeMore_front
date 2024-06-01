<template>
    <FpsIndecator v-if="configStore.config.showFps" />
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
    <ModalWindow />

</template>
<script setup lang="ts">
import { useScreenStore } from '@/entities/screen/model'
import { onMounted, onUnmounted } from 'vue'
import { Header } from '@/widgets/header'
import { Footer } from '@/widgets/footer'
import { useConfigStore } from '@/entities/config/store'
import { ModalWindow } from '@/features/modal'
import { FpsIndecator } from '@/widgets/fps'
const configStore = useConfigStore();
const screenStore = useScreenStore()
const { setPlatform } = screenStore
const onResize = () => setPlatform(window.innerWidth)
onMounted(async () => {
    setPlatform(window.innerWidth)
    window.addEventListener('resize', onResize)
})
onUnmounted(() => {
    window.removeEventListener('resize', onResize)
})

</script>
<style scoped lang="scss">
.fade-enter-active,
.fade-leave-active {
    transition: all 0.125s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.wrapper {

    background-size: cover;
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


</style>
