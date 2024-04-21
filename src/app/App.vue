<script setup lang="ts">
import { useScreenStore } from '@/entities/screen/model';
import { onMounted, onUnmounted } from 'vue';
import { useFps } from '@vueuse/core'
import { PopUp } from '@/features/popup';
import { Header } from '@/widgets/header';
import { Footer } from '@/widgets/footer';
import { Container } from '@/shared/ui/container';
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

    <!-- <div class="fps">
        FPS: {{ fps }}
    </div> -->
    <div class="wrapper">

        <Header />
        <main>
            <transition name="fade" mode="out-in">
                <RouterView />
            </transition>
        </main>
        <Footer />
    </div>
    <!-- <PopUp /> -->
</template>

<style lang="scss">
.fade-enter-active,
.fade-leave-active {

    transition: all 0.2s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: scale(1.01);
}

.wrapper {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    min-height: 100vh;
    max-width: 1532px;
    margin: 0 auto;
    padding: 25px 16px;
    box-sizing: border-box;
}

.fps {
    position: absolute;
    top: 20px;
    left: 20px;
    color: var(--main-color)
}
</style>
