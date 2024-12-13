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
    <KeyMap v-if="configStore.config.showKeyboard" />
  </div>
  <FinalScreen v-else />
</template>

<script lang="ts" setup>
  import { KeyMap } from '@/features/layouts/keymap'
  import { useConfigStore } from '@/entities/config/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'
  import { Icon } from '@iconify/vue'
  import { useKeyModifier, useMagicKeys, whenever } from '@vueuse/core'
  import { onMounted, onUnmounted, watch } from 'vue'
  import { Test } from '@/widgets/test'
  import { TestInput } from '@/features/test/input'
  import { TestControls } from '@/features/test/controls'
  import { FinalScreen } from '@/widgets/final'

  const testState = useTestStateStore()
  const configStore = useConfigStore()

  const capsLockState = useKeyModifier('CapsLock')
  const { Ctrl_Space, Ctrl_Enter } = useMagicKeys()

  whenever(Ctrl_Space, () => {
    //TODO: make it only with infinity modes
    if (testState.isActive) {
      testState.finish()
    }
  })

  whenever(Ctrl_Enter, () => {
    testState.restartTest()
  })
  // watch(() => configStore.config, async () => {
  //   await testState.init()
  // }, { deep: true })

  onMounted(async () => {
    await testState.init()
  })

  onUnmounted(() => {
    testState.clear()
  })
</script>

<style lang="scss" scoped>
  .test {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    padding-top: 100px;

    &__container {
      display: flex;
      justify-content: center;
      width: 100%;
    }
  }

  .caps-detected {
    align-self: flex-start;
    width: fit-content;
    padding: 4px;
    color: var(--text-color);
    background-color: var(--error-color);
    border-radius: var(--border-radius);
  }

  .refresh {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 16px;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: var(--border-radius);
    transition: all var(--transition-duration);

    svg {
      color: var(--sub-color);
      transition: all var(--transition-duration);
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
