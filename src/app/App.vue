<template>

    <Transition name="fade" mode="out-in">

        <div class="wrapper" v-if="!testState.isLoading">
            <FpsIndecator v-if="configStore.config.showFps" />
            <Header />
            <main>
                <router-view v-slot="{ Component, route }">
                    <transition name="fade" mode="out-in">
                        <component :is="Component" :key="route.path" />
                    </transition>
                </router-view>
            </main>
            <Footer />
            <ModalWindow />
        </div>
        <div v-else class="loader-wrapper wrapper">
            <header class="loader-wrapper__header">
                <Logo />
            </header>
            <main class="loader-wrapper__body">
                <div>
                    <div class="loader"></div>
                </div>
            </main>
            <footer class="loader-wrapper__footer"></footer>
        </div>
    </Transition>

</template>
<script setup lang="ts">
import { useScreenStore } from '@/entities/screen/model'
import { onBeforeMount, onMounted, onUnmounted, provide } from 'vue'
import { Header } from '@/widgets/header'
import { Logo } from '@/shared/ui/logo'
import { Footer } from '@/widgets/footer'
import { useConfigStore } from '@/entities/config/store'
import { ModalWindow } from '@/widgets/modal'
import { FpsIndecator } from '@/widgets/fps'
import { useTestStateStore } from '@/entities/test'
const configStore = useConfigStore();
const screenStore = useScreenStore()
const testState = useTestStateStore();
const { setPlatform } = screenStore
import { applyTheme, themesList } from '@/shared/lib/hooks/useThemes'
const onResize = () => setPlatform(window.innerWidth)
const { config } = useConfigStore()

provide('themes', themesList)
onBeforeMount(async () => {
    // //Apply themes 
    await applyTheme(config.theme)

})
onMounted(async () => {
    //Set platform on load window : 'desktop' | 'tablet' | 'mobile'
    setPlatform(window.innerWidth)
    window.addEventListener('resize', onResize)
})
onUnmounted(() => {
    window.removeEventListener('resize', onResize)
})

</script>
<style lang="scss">
:root {
    --bg-color: #121212;
    --main-color: #528bff;
    --sub-color: #3a3a3a;
    --sub-alt-color: #1c1c1c;
    --text-color: #eeeeee;
    --error-color: #da3333;
    --error-extra-color: #791717;
}

#app {
    background-color: var(--bg-color);
}

.fade-enter-active,
.fade-leave-active {
    transition: all 0.125s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.loader {
    min-width: 40px;
    min-height: 40px;
    border: 4px solid var(--text-color);

    border-bottom-color: var(--bg-color);
    border-radius: 100%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1.5s linear infinite;
}

.loader-wrapper {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 20px;
    justify-content: center;
    align-items: center;

    &__header {
        display: flex;
        width: 100%;
    }

    &__body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
    }
}

@keyframes rotation {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
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
