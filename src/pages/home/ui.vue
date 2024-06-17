<template>
    <div class="test">


        <div class="test__controls">
            <Button @click="handleOpenModalLang" size="s">
                <template #left-icon>


                    <Icon width="24" icon="solar:globus-bold" />
                </template>
                {{ configStore.config.language }}
            </Button>
            <Typography color="primary"> {{ configStore.config.time - timerStore.time }}</Typography>
        </div>

        <div class="caps-detected" v-show="capsLockState">CAPS!</div>
        <div class="words">

            <p v-for="(word, index) in words" :key="`${word}-${index}`" class="word"
                :class="{ current: index === testState.currentWordElementIndex }">
                {{ word }}
            </p>
        </div>

        <Popper class="refresh__tip" hover arrow :interactive="false" content="Restart test">
            <button @click.stop="restartTest" class="refresh">
                <Icon width="24" icon="eva:refresh-fill" />
            </button>
        </Popper>
        <KeyMap />
    </div>
</template>

<script lang="ts" setup>
import { KeyMap } from '@/features/layouts/keymap'
import { Button } from '@/shared/ui/button'
import { useConfigStore } from '@/entities/config/store'
import { useWordGeneratorStore } from '@/entities/generator/store'
import { useTestStateStore } from '@/entities/test'
import { Icon } from '@iconify/vue'
import { Typography } from '@/shared/ui/typography'
import { LangModal } from '@/features/modal/language'
import Popper from 'vue3-popper'
import { useKeyModifier } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'
import { useModal } from '@/entities/modal/store'
import { useTimerStore } from '@/entities/timer/model/store'
const modal = useModal()
const testState = useTestStateStore()
const capsLockState = useKeyModifier('CapsLock')
const configStore = useConfigStore()
const timerStore = useTimerStore()
const generator = useWordGeneratorStore()
const words = ref<any>([])
const init = async (): Promise<void> => {
    await startTest()
}

const handleOpenModalLang = () => {
    modal.open(LangModal, [], true)
}

const startTest = async () => {
    try {
        timerStore.resetTimer()
        testState.setActive(true)
        await configStore.setLanguage(configStore.config.language)
        const currentLanguage = configStore.currentLang
        //Maybe change later
        if (!currentLanguage) return
        const generatedWords = await generator.generateWords(currentLanguage)
        words.value = generatedWords
        timerStore.startTimer()
    } catch (error) {
        console.error('Произошла ошибка:', error)
    }
}

const restartTest = (): void => {
    startTest()
}

onMounted(() => {
    init()
})
onUnmounted(() => {
    timerStore.terminateWorker()
})
</script>

<style lang="scss" scoped>
.test {
    padding-top: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;

    &__container {


        display: flex;
        width: 100%;
        justify-content: center;
    }

    &__controls {
        margin-bottom: 8px;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 20px;
    }
}

.words {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    align-content: flex-start;
    overflow: hidden;
    height: 142px;
}

.current {
    color: var(--text-color) !important;
}

.word {
    position: relative;
    font-size: 32px;
    line-height: 1em;
    margin: 8px;
    color: var(--sub-color);
    //user-select: none;
}

.caps-detected {
    width: fit-content;
    padding: 4px;
    border-radius: var(--border-radius);
    color: var(--text-color);
    background-color: var(--error-color);
    align-self: flex-start;
}

.refresh {
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: var(--border-radius);
    border: 0px;
    padding: 6px 16px;
    background-color: transparent;
    transition: all var(--transition-duration);

    svg {
        transition: all var(--transition-duration);
        color: var(--sub-color);
    }

    &:active {
        box-shadow: 0 0 0 1px var(--text-color);
    }

    &:hover {

        svg {
            color: var(--text-color);
        }
    }

    &__tip {
        margin-top: 20px;
    }
}
</style>
