<template>
  <div v-if="testState.isActive" class="test">
    <p v-show="testState.isRepeated">is restarted</p>
    <div v-show="capsLockState" class="caps-detected">CAPS!</div>
    <TestControls />
    <TestInput />
    <Test :is-right-to-left="testState.isRightToLeft" />
    <Popper class="refresh__tip" hover arrow :interactive="false" content="Restart test">
      <button
        role="button"
        class="refresh"
        @click.stop="testState.restartTest"
        aria-label="Reapeat test"
      >
        <Icon width="24" icon="eva:refresh-fill" />
      </button>
    </Popper>
    <KeyMap />
  </div>
  <FinalScreen v-else />
</template>

<script lang="ts" setup>
  import { KeyMap } from '@/features/layouts/keymap'
  import { useConfigStore } from '@/entities/config/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'

  import { Icon } from '@iconify/vue'
  import { useKeyModifier, useMagicKeys } from '@vueuse/core'
  import { onMounted, onUnmounted, watch } from 'vue'
  import { useInputStore } from '@entities/input/model/store'
  import { Test } from '@/widgets/test'
  import { TestInput } from '@/features/test/input'
  import { TestControls } from '@/features/test/controls'
  import { FinalScreen } from '@/widgets/final'
  const testState = useTestStateStore()
  const configStore = useConfigStore()
  const inputStore = useInputStore()

  const capsLockState = useKeyModifier('CapsLock')
  const keys = useMagicKeys()
  const ctrlEnterPressed = keys['ctrl+enter']
  watch(ctrlEnterPressed, (isPressed) => {
    if (isPressed) {
      testState.restartTest()
    }
  })

  watch(
    () => configStore.config,
    async () => {
      inputStore.clearAllInputData()
      await testState.init()
    },
    { deep: true }
  )

  onMounted(async () => {
    await testState.init()
  })

  onUnmounted(() => {
    testState.clear()
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
