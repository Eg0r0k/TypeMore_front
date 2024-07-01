<template>
    <div class="test">
        <div class="test__controls">
            <Button @click="handleOpenModalLang" size="s">
                <template #left-icon>
                    <Icon width="24" icon="solar:globus-bold" />
                </template>
                {{ configStore.config.language }}
            </Button>
            <Typography color="primary">
                Timer:{{ configStore.config.time - timerStore.time }}
            </Typography>
            <Typography color="primary">
                State:{{ testState.isActive }}
            </Typography>
            <Typography color="primary">
                Acc:{{ accuracyTest }}% {{ inputStore.accuracy.correct }} {{ inputStore.accuracy.incorrect }}
            </Typography>
            <Typography color="primary">
                Words: {{ testState.currentWordElementIndex }}/{{ configStore.config.words }}
            </Typography>
            <Typography color="primary">
                Wpm/RawWpm: {{ inputStore.wpm }}/{{ inputStore.raw }}
            </Typography>
        </div>
        <Typography size="m" color="primary">
            history: {{ inputStore.input.history }}

        </Typography>
        <Typography size="m" color="primary">
            miss: {{ inputStore.missedWords }}
        </Typography>
        <p v-show="testState.isRepeated">is restarted</p>
        <div class="caps-detected" v-show="capsLockState">CAPS!</div>
        <input v-focus :disabled="!testState.isActive" :value="inputStore.input.current"
            @input="inputStore.handleInput($event)" @keydown.delete="inputStore.backspaceToPrevious()"
            @keydown.space.prevent="inputStore.handleSpace()" type="text">
        <Test :isRightToLeft="isRightToLeft" />


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
import { useConfigStore } from '@/entities/config/model/store'

import { useTestStateStore } from '@/entities/test'
import { Icon } from '@iconify/vue'
import { Typography } from '@/shared/ui/typography'
import { LangModal } from '@/features/modal/language'
import Popper from 'vue3-popper'
import { useFocus, useKeyModifier } from '@vueuse/core'
import { onMounted, onUnmounted, computed, watch, ref } from 'vue'
import { useModal } from '@/entities/modal/model/store'
import { useTimerStore } from '@/entities/timer/model/store'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@/entities/input/model'
import { roundTo2 } from '@/shared/lib/helpers/numbers'
import { Test } from '@/widgets/test'
const modal = useModal()
const testState = useTestStateStore()
const capsLockState = useKeyModifier('CapsLock')
const configStore = useConfigStore()
const timerStore = useTimerStore()
const generator = useWordGeneratorStore()

const inputStore = useInputStore()
const isRightToLeft = ref(false)
const currentLanguage = computed(() => configStore.currentLang)





const accuracyTest = computed(() => {
    const acc = (inputStore.accuracy.correct / (inputStore.accuracy.correct + inputStore.accuracy.incorrect)) * 100
    return isNaN(acc) ? 100 : roundTo2(acc)
})





const init = async (): Promise<void> => {
    testState.setCurrentWordElementIndex(0)
    inputStore.clearAllInputData()
    timerStore.resetTimer()

    testState.setActive(true)
    generator.reset()
    inputStore.initializeLetterClasses()
    timerStore.startTimer()
    try {
        const lang = configStore.config.language
        await configStore.setLanguage(lang)
    }
    catch (e) {
        console.error(e)
    }
    if (!currentLanguage.value) {
        await configStore.setLanguage('russian')
        await init()
        return
    }
    try {
        await generator.generateWords(currentLanguage.value)

        isRightToLeft.value = !!currentLanguage.value.rightToleft
    }
    catch (e) {
        console.error(e)
    }

}

const handleOpenModalLang = (): void => {
    modal.open(LangModal, [], 'top')
}
//TODO: add support for: 
// arabian   - 
// hebrew   -
const startTest = async () => {
    try {
        timerStore.resetTimer()

        await configStore.setLanguage(configStore.config.language)

        //Maybe change later
        if (!currentLanguage.value) return
        await generator.generateWords(currentLanguage.value)

    } catch (error) {
        console.error('Произошла ошибка:', error)
    }
}
const reapeatTest = (): void => {
    testState.setRepeated(true)
}

const restartTest = async (): Promise<void> => {
    await init()
}

watch(() => configStore.currentLang, async () => {
    inputStore.clearAllInputData()
    await init();
})

onMounted(async () => {
    await init()
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

.caps-detected {
    width: -moz-fit-content;
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
