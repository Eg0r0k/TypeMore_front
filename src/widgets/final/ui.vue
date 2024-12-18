<template>
  <div class="final-screen">
    <AddWidget class="final-screen__add" />
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
      <div class="wide-stats">Test</div>
      <div class="wide-stats">
        <div class="wide-stats__raw">
          <Typography color="sub" size="s">Raw</Typography>
          <Typography color="main" size="xl">
            {{ rawWpm }}
          </Typography>
        </div>
        <div class="wide-stats__characters">
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
    <FinalControls @copyScreenshot="debounceScreenshot" />
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

  import { computed, ref } from 'vue'

  import { useDebounceFn } from '@vueuse/core'
  import { AddWidget } from '../add'
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
    const { default: html2canvas } = await import('html2canvas')
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
  const debounceScreenshot = useDebounceFn(handleCopyScreenshot, 350)
</script>

<style lang="scss" scoped>
  .wide-stats {
    display: flex;
    justify-content: space-between;
  }

  .stats {
    display: flex;
    flex-direction: column;
  }

  .final-screen {
    &__add {
      margin-bottom: 20px;
    }

    &__result {
      display: grid;
      grid-template-areas:
        'stats chart'
        'more-stats more-stats';
      grid-template-columns: auto 1fr;
      gap: 1rem;
      align-items: center;
    }

    &__chart {
      height: 200px;
    }
  }

  @media screen and (width <=784px) {
    .final-screen__result {
      grid-template-columns: 1fr;
      grid-template-areas:
        'stats'
        'chart'
        'more-stats';
    }

    .stats {
      justify-items: start;
      justify-self: center;
    }
  }
</style>
