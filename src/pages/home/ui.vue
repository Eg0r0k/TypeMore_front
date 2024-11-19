<template>
  <div v-if="testState.isActive" class="test">
    <TestControls />

    <p v-show="testState.isRepeated">is restarted</p>
    <div v-show="capsLockState" class="caps-detected">CAPS!</div>
    <TestInput />
    <Test :is-right-to-left="isRightToLeft" />

    <Popper class="refresh__tip" hover arrow :interactive="false" content="Restart test">
      <button class="refresh" @click.stop="restartTest" label="reapeat test">
        <Icon width="24" icon="eva:refresh-fill" />
      </button>
    </Popper>

    <KeyMap />
  </div>

  <div v-else>
    <TestChart />
    <Button @click="playReplay">Test</Button>
    <Button @click="restartTest"> Reapat </Button>
    <div id="replayWords">
      <p v-for="word in replayStore.wordList" :key="word">
        {{ word }}
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { KeyMap } from '@/features/layouts/keymap'
import { Button } from '@/shared/ui/button'
import { useConfigStore } from '@/entities/config/model/store'

import { useTestStateStore } from '@/entities/test'
import { Icon } from '@iconify/vue'

import Popper from 'vue3-popper'
import { useKeyModifier } from '@vueuse/core'
import { onMounted, onUnmounted, computed, watch, ref } from 'vue'

import { useTimerStore } from '@/entities/timer/model/store'
import { useWordGeneratorStore } from '@/entities/generator/model/store'
import { useInputStore } from '@/entities/input/model'
import { Test } from '@/widgets/test'
import { TestChart } from '@/shared/ui/chart'
import { TestInput } from '@/features/test/input'
import { TestControls } from '@/features/test/controls'
import { useReplayStore } from '@/entities/replay/model/store'
import { QuoteData } from '@/shared/lib/types/types'

const testState = useTestStateStore()
const capsLockState = useKeyModifier('CapsLock')
const configStore = useConfigStore()
const timerStore = useTimerStore()
const generator = useWordGeneratorStore()
const replayStore = useReplayStore()
const inputStore = useInputStore()
const isRightToLeft = ref(false)

const currentLanguage = computed(() => configStore.currentLang)
const russianQuotes: QuoteData = {
  language: 'russian',
  quotes: [
    {
      id: 1,
      source: 'A. Чехов',
      text: 'Луна стояла высоко над садом.',
      length: 26
    },
    {
      id: 2,
      source: 'В. Даль',
      text: 'Не может русский человек быть счастлив в одиночку.',
      length: 50
    }
  ]
}
const playReplay = async () => {
  replayStore.playReplay()
}
const init = async (): Promise<void> => {
  testState.setCurrentWordElementIndex(0)
  inputStore.clearAllInputData()

  timerStore.resetTimer()

  testState.setActive(true)
  generator.reset()

  timerStore.startTimer()
  try {
    const lang = configStore.config.language
    await configStore.setLanguage(lang)
  } catch (e) {
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
  } catch (e) {
    console.error(e)
  }
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
  console.log('restart')
  await init()
}

watch(
  () => configStore.currentLang,
  async () => {
    inputStore.clearAllInputData()
    await init()
  }
)

onMounted(async () => {
  await init()
})

onUnmounted(() => {
  timerStore.resetTimer()
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
