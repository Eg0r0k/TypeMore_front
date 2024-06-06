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
import { onBeforeMount, onMounted, onUnmounted, provide, ref } from 'vue'
import { Header } from '@/widgets/header'
import { Logo } from '@/shared/ui/logo'
import { Footer } from '@/widgets/footer'
import { useConfigStore } from '@/entities/config/store'
import { ModalWindow } from '@/widgets/modal'
import { FpsIndecator } from '@/widgets/fps'
import { cachedFetchJson } from '@/shared/lib/helpers/json-files'
import { Theme } from '@/features/modal/theme/types/themes'
import { useTestStateStore } from '@/entities/test'
const configStore = useConfigStore();
const screenStore = useScreenStore()
const testState = useTestStateStore();
const { config } = useConfigStore()
const { setPlatform } = screenStore
const root = document.documentElement;
const onResize = () => setPlatform(window.innerWidth)
const themesList = ref<Theme[]>([]);
const fetchThemes = async (): Promise<Theme[]> => {
    const themes = await cachedFetchJson<Theme[]>('./static/themes/themes.json');
    themesList.value = themes.sort((a, b) => a.name.localeCompare(b.name));
    return []
}

const applyTheme = (theme: Theme) => {
    Object.entries(theme).forEach(([key, val]) => {
        root.style.setProperty(key, val)
    })
}


const useConfigTheme = () => {
    const savedTheme = config.theme
    if (savedTheme) {
        const foundTheme = themesList.value.find(theme => theme.name === savedTheme)
        if (foundTheme) {
            applyTheme(foundTheme)
        }
    }
}
provide('themes', themesList)
onBeforeMount(async () => {
    await fetchThemes()
    useConfigTheme()
    testState.setLoading(false)
})

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
