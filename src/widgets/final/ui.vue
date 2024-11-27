<template>
  <div class="final-screen">
    <div class="final-screen__result" ref="finalScreenRef">
      <div class="stats">
        <div class="final-screen__WPM">
          <Typography color="sub" size="xl">WPM</Typography>

          <Popper placement="top" hover arrow :interactive="false" :content="`${getStats.wpm} WPM`">
            <Typography color="main" isBold size="xxxl">
              {{ wpm }}
            </Typography>
          </Popper>
        </div>
        <div class="final-screen__acc">
          <Typography color="sub" size="xl">Acc</Typography>
          <Popper placement="top" hover arrow :interactive="false">
            <template #content>
              {{ inputStore.accuracyPercentage }}%
              <br />
              {{ accuracy.incorrect }} incorrect
              <br />
              {{ accuracy.correct }} correct
            </template>
            <Typography color="main" isBold size="xxxl">{{ accuracyPercentage }}%</Typography>
          </Popper>
        </div>
      </div>

      <TestChart class="final-screen__chart chart" />
      <div class="wideStats">Test</div>
      <div class="wideStats">
        <div class="wideStats__raw">
          <Typography color="sub" size="s">Raw</Typography>
          <Typography color="main" size="xl">
            {{ rawWpm }}
          </Typography>
        </div>
        <div class="wideStats__characters">
          <Typography color="sub" size="s">Characters</Typography>
          <Popper placement="top" hover arrow :interactive="false">
            <template #content>
              correct
              <br />
              incorrect
              <br />
              missed
              <br />
              extra
              <br />
            </template>
            <Typography color="main" size="xl">
              {{ characterStats }}
            </Typography>
          </Popper>
        </div>
      </div>
    </div>
    <FinalControls @copyScreenshot="handleCopyScreenshot" />
  </div>
</template>

<script setup lang="ts">
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { useInputStore } from '@entities/input/model/store'
  import { FinalControls } from '@/features/final/controls'
  import { useStats } from '@/shared/lib/hooks/useStats'
  import { TestChart } from '@/shared/ui/chart'
  import { Typography } from '@/shared/ui/typography'

  import html2canvas from 'html2canvas'
  import { computed, ref } from 'vue'
  import Popper from 'vue3-popper'
  const { getStats } = useStats()
  const rawWpm = computed(() => Math.floor(getStats.value.wpmRaw))
  const wpm = computed(() => Math.floor(getStats.value.wpm))
  const accuracy = computed(() => inputStore.accuracy)
  const accuracyPercentage = computed(() => Math.floor(inputStore.accuracyPercentage))
  const characterStats = computed(
    () =>
      `${getStats.value.correctChars}/${getStats.value.incorrectChars}/${getStats.value.missedChars}/${getStats.value.extraChars}`
  )

  const inputStore = useInputStore()

  const alertStore = useAlertStore()
  const finalScreenRef = ref<HTMLElement | null>(null)
  const captureScreenshot = async (el: HTMLElement | null): Promise<string | null> => {
    if (!el) return null
    const canvas = await html2canvas(el)
    return canvas.toDataURL('image/png')
  }

  const handleCopyScreenshot = async (): Promise<void> => {
    const image = await captureScreenshot(finalScreenRef.value)
    if (!image) return

    try {
      const clipboardItem = new ClipboardItem({
        'image/png': await fetch(image).then((res) => res.blob())
      })
      await navigator.clipboard.write([clipboardItem])
      alertStore.addAlert({
        msg: 'Stats copied to clipboard',
        type: AlertType.Success,
        duration: 2000
      })
    } catch (err: any) {
      alertStore.addAlert({
        title: 'Failed to copy to clipboard',
        msg: err.message || String(err),
        type: AlertType.Error,
        duration: 2000
      })
    }
  }
</script>

<style lang="scss" scoped>
  @media screen and (max-width: 375px) {
  }

  .wideStats {
    display: flex;
    justify-content: space-between;
  }

  .final-screen {
    &__result {
      display: grid;
      gap: 1rem;
      align-items: center;
      grid-template-columns: auto 1fr;
      grid-template-areas:
        'stats chart'
        'morestats morestats';
      background-color: var(--bg-color);
      padding: 15px 25px 15px 25px;
    }

    &__chart {
      height: 200px;
    }
  }
</style>
