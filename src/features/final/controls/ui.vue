<template>
  <nav class="final-screen__controls">
    <Popper offset-distance="2" hover arrow :interactive="false" content="Reapeat test">
      <Button color="shadow">
        <template #left-icon>
          <Icon width="24" icon="tabler:player-track-prev-filled" />
        </template>
      </Button>
    </Popper>
    <Popper offset-distance="2" hover arrow :interactive="false" content="Whatch replay">
      <Button color="shadow" @click="playReplay">
        <template #left-icon>
          <Icon width="24" icon="mynaui:video-solid" />
        </template>
      </Button>
    </Popper>
    <Popper offset-distance="2" hover arrow :interactive="false" content="Restart test">
      <Button color="shadow" @click="testState.restartTest">
        <template #left-icon>
          <Icon width="24" icon="eva:refresh-fill" />
        </template>
      </Button>
    </Popper>
    <Popper offset-distance="2" hover arrow :interactive="false" content="Screenshot">
      <Button color="shadow" @click="handleScreenshot">
        <template #left-icon>
          <Icon width="24" icon="ion:camera" />
        </template>
      </Button>
    </Popper>
  </nav>
</template>

<script setup lang="ts">
  import { useReplayStore } from '@/entities/replay/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'

  import { Button } from '@/shared/ui/button'
  import { Icon } from '@iconify/vue'
  import Popper from 'vue3-popper'
  const replayStore = useReplayStore()
  const testState = useTestStateStore()

  const playReplay = async () => {
    replayStore.playReplay()
  }
  const emit = defineEmits<{ (e: 'copyScreenshot'): void }>()

  const handleScreenshot = () => {
    emit('copyScreenshot')
  }
</script>

<style scoped lang="scss">
  .final-screen__controls {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    width: 100%;
  }
</style>
